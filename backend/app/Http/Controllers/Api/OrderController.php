<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\FormationEnrollment;
use App\Models\Invoice;
use App\Models\Order;
use App\Models\OrderLine;
use App\Models\Service;
use App\Models\User;

use App\Services\ActivityLogger;
use App\Services\InvoiceNumberGenerator;
use App\Services\NotificationService;
use App\Services\OrderNumberGenerator;
use App\Services\PaymentService;
use App\Services\ScopeService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;
use OpenApi\Attributes as OA;

class OrderController extends Controller
{
    public function __construct(
        private readonly ScopeService $scopeService,
        private readonly OrderNumberGenerator $orderNumber,
        private readonly InvoiceNumberGenerator $invoiceNumber,
        private readonly ActivityLogger $logger,
        private readonly PaymentService $paymentService,
        private readonly NotificationService $notifications,
    ) {}

    private function scopeQuery(Request $request, $query)
    {
        $agencyIds = $this->scopeService->agencyIds($request->user());

        if ($agencyIds === null) {
            return $query;
        }

        return $query->whereIn('agency_id', $agencyIds);
    }

    #[OA\Get(
        path: '/api/orders',
        summary: 'Lister les commandes (filtres statut/client/agence/dates)',
        tags: ['Commandes'],
        security: [['sanctum' => []]],
        parameters: [
            new OA\Parameter(name: 'search', in: 'query', description: 'N° de commande ou nom du client', schema: new OA\Schema(type: 'string')),
            new OA\Parameter(name: 'status', in: 'query', schema: new OA\Schema(type: 'string', enum: ['draft', 'confirmed', 'completed', 'cancelled'])),
            new OA\Parameter(name: 'client_id', in: 'query', schema: new OA\Schema(type: 'string', format: 'uuid')),
            new OA\Parameter(name: 'agency_id', in: 'query', schema: new OA\Schema(type: 'string', format: 'uuid')),
            new OA\Parameter(name: 'commercial_id', in: 'query', schema: new OA\Schema(type: 'string', format: 'uuid')),
            new OA\Parameter(name: 'from', in: 'query', schema: new OA\Schema(type: 'string', format: 'date')),
            new OA\Parameter(name: 'to', in: 'query', schema: new OA\Schema(type: 'string', format: 'date')),
            new OA\Parameter(name: 'per_page', in: 'query', schema: new OA\Schema(type: 'integer', default: 15)),
        ],
        responses: [
            new OA\Response(response: 200, description: 'Liste paginée des commandes'),
        ]
    )]
    public function index(Request $request): JsonResponse
    {
        $query = Order::with('client:id,first_name,last_name,email', 'agency:id,name', 'commercial.user:id,first_name,last_name', 'lines')
            ->when($request->filled('search'), function ($q) use ($request) {
                $search = $request->input('search');
                $q->where(function ($inner) use ($search) {
                    $inner->where('number', 'like', "%{$search}%")
                        ->orWhereHas('client', fn ($c) => $c->where('first_name', 'like', "%{$search}%")
                            ->orWhere('last_name', 'like', "%{$search}%"));
                });
            })
            ->when($request->status, fn ($q, $v) => $q->where('status', $v))
            ->when($request->client_id, fn ($q, $v) => $q->where('client_id', $v))
            ->when($request->agency_id, fn ($q, $v) => $q->where('agency_id', $v))
            ->when($request->commercial_id, fn ($q, $v) => $q->where('commercial_id', $v))
            ->when($request->from, fn ($q, $v) => $q->whereDate('order_date', '>=', $v))
            ->when($request->to, fn ($q, $v) => $q->whereDate('order_date', '<=', $v));

        $this->scopeQuery($request, $query);

        return response()->json(
            $query->orderByDesc('order_date')->paginate(min((int) $request->input('per_page', 15), 100))
        );
    }

    #[OA\Post(
        path: '/api/orders',
        summary: 'Créer une commande (lignes catalogue ou manuelles, snapshots de prix)',
        tags: ['Commandes'],
        security: [['sanctum' => []]],
        responses: [
            new OA\Response(response: 201, description: 'Commande créée'),
            new OA\Response(response: 422, description: 'Erreur de validation'),
        ]
    )]
    public function store(Request $request): JsonResponse
    {
        $data = $this->validateOrder($request);

        $order = DB::transaction(function () use ($data, $request) {
            $agencyId = $data['agency_id'] ?? $request->user()->agency_id ?? null;
            if (! $agencyId) {
                throw ValidationException::withMessages(['agency_id' => "L'agence est requise."]);
            }

            $lines = $this->buildLines($data['lines']);
            $subtotal = round(collect($lines)->sum('line_total'), 2);
            $discount = (float) ($data['discount'] ?? 0);
            $total = round(max(0, $subtotal - $discount), 2);

            $order = Order::create([
                'number' => $this->orderNumber->next(),
                'agency_id' => $agencyId,
                'client_id' => $data['client_id'],
                'commercial_id' => $data['commercial_id'] ?? null,
                'status' => $data['status'] ?? 'draft',
                'order_date' => $data['order_date'] ?? now()->toDateString(),
                'subtotal' => $subtotal,
                'discount' => $discount,
                'vat_rate' => $data['vat_rate'] ?? 0,
                'total_amount' => $total,
                'notes' => $data['notes'] ?? null,
            ]);

            foreach ($lines as $line) {
                $order->lines()->create($line);
            }

            $this->logger->log(
                action: 'created',
                entityType: 'order',
                entityId: $order->id,
                description: "Commande {$order->number} créée ({$order->lines()->count()} lignes, {$total} FCFA)",
                newValues: ['number' => $order->number, 'total' => $total],
                request: $request,
            );

            return $order;
        });

        return response()->json(
            $order->fresh()->load(['client:id,first_name,last_name,email', 'agency:id,name', 'lines']),
            201
        );
    }

    #[OA\Get(
        path: '/api/orders/{order}',
        summary: 'Détail d\'une commande',
        tags: ['Commandes'],
        security: [['sanctum' => []]],
        parameters: [
            new OA\Parameter(name: 'order', in: 'path', required: true, schema: new OA\Schema(type: 'string', format: 'uuid')),
        ],
        responses: [
            new OA\Response(response: 200, description: 'Détail de la commande'),
        ]
    )]
    public function show(Order $order): JsonResponse
    {
        return response()->json(
            $order->load(['client', 'agency', 'commercial.user', 'lines', 'invoice'])
        );
    }

    #[OA\Put(
        path: '/api/orders/{order}',
        summary: 'Modifier une commande (statut, lignes, remise)',
        tags: ['Commandes'],
        security: [['sanctum' => []]],
        parameters: [
            new OA\Parameter(name: 'order', in: 'path', required: true, schema: new OA\Schema(type: 'string', format: 'uuid')),
        ],
        responses: [
            new OA\Response(response: 200, description: 'Commande modifiée'),
            new OA\Response(response: 422, description: 'Erreur de validation'),
        ]
    )]
    public function update(Request $request, Order $order): JsonResponse
    {
        if ($order->status === 'completed' || $order->status === 'cancelled') {
            return response()->json(['message' => "Une commande {$order->status} ne peut plus être modifiée."], 422);
        }

        $data = $this->validateOrder($request, update: true);

        $order = DB::transaction(function () use ($order, $data, $request) {
            $lines = isset($data['lines']) ? $this->buildLines($data['lines']) : $order->lines;

            $subtotal = round(collect($lines)->sum('line_total'), 2);
            $discount = (float) ($data['discount'] ?? $order->discount);
            $total = round(max(0, $subtotal - $discount), 2);

            $order->update([
                'status' => $data['status'] ?? $order->status,
                'commercial_id' => $data['commercial_id'] ?? $order->commercial_id,
                'order_date' => $data['order_date'] ?? $order->order_date,
                'subtotal' => $subtotal,
                'discount' => $discount,
                'vat_rate' => $data['vat_rate'] ?? $order->vat_rate,
                'total_amount' => $total,
                'notes' => array_key_exists('notes', $data) ? $data['notes'] : $order->notes,
            ]);

            if (isset($data['lines'])) {
                $order->lines()->delete();
                foreach ($lines as $line) {
                    $order->lines()->create($line);
                }
            }

            $this->logger->log(
                action: 'updated',
                entityType: 'order',
                entityId: $order->id,
                description: "Commande {$order->number} modifiée",
                request: $request,
            );

            return $order;
        });

        return response()->json($order->fresh()->load(['client:id,first_name,last_name,email', 'agency:id,name', 'lines']));
    }

    #[OA\Delete(
        path: '/api/orders/{order}',
        summary: 'Supprimer une commande (soft delete)',
        tags: ['Commandes'],
        security: [['sanctum' => []]],
        parameters: [
            new OA\Parameter(name: 'order', in: 'path', required: true, schema: new OA\Schema(type: 'string', format: 'uuid')),
        ],
        responses: [
            new OA\Response(response: 204, description: 'Commande supprimée'),
        ]
    )]
    public function destroy(Request $request, Order $order): JsonResponse
    {
        $number = $order->number;
        $order->delete();

        $this->logger->log(
            action: 'deleted',
            entityType: 'order',
            entityId: $order->id,
            description: "Commande {$number} supprimée",
            request: $request,
        );

        return response()->json(null, 204);
    }

    #[OA\Post(
        path: '/api/orders/{order}/confirm',
        summary: 'Confirmer une commande',
        tags: ['Commandes'],
        security: [['sanctum' => []]],
        parameters: [
            new OA\Parameter(name: 'order', in: 'path', required: true, schema: new OA\Schema(type: 'string', format: 'uuid')),
        ],
        responses: [
            new OA\Response(response: 200, description: 'Commande confirmée'),
        ]
    )]
    public function confirm(Request $request, Order $order): JsonResponse
    {
        if (! in_array($order->status, ['draft'], true)) {
            return response()->json(['message' => "Seule une commande brouillon peut être confirmée (statut actuel : {$order->status})."], 422);
        }

        $order->update(['status' => 'confirmed']);

        $this->logger->log(
            action: 'confirmed',
            entityType: 'order',
            entityId: $order->id,
            description: "Commande {$order->number} confirmée",
            request: $request,
        );

        return response()->json($order->fresh()->load(['client', 'agency', 'lines']));
    }

    #[OA\Post(
        path: '/api/orders/{order}/invoice',
        summary: 'Générer la facture d\'une commande (lignes + prix snapshot + commercial)',
        tags: ['Commandes'],
        security: [['sanctum' => []]],
        parameters: [
            new OA\Parameter(name: 'order', in: 'path', required: true, schema: new OA\Schema(type: 'string', format: 'uuid')),
        ],
        responses: [
            new OA\Response(response: 201, description: 'Facture générée'),
            new OA\Response(response: 422, description: 'Commande non facturable'),
        ]
    )]
    public function invoice(Request $request, Order $order): JsonResponse
    {
        if ($order->invoice_id) {
            return response()->json(['message' => 'Une facture existe déjà pour cette commande.'], 422);
        }

        if ($order->status === 'cancelled') {
            return response()->json(['message' => 'Une commande annulée ne peut pas être facturée.'], 422);
        }

        $invoice = DB::transaction(function () use ($order, $request) {
            $client = $order->client;

            $invoice = Invoice::create([
                'number' => $this->invoiceNumber->next(),
                'agency_id' => $order->agency_id,
                'client_id' => $order->client_id,
                'client_name' => $client ? trim("{$client->first_name} {$client->last_name}") : null,
                'commercial_id' => $order->commercial_id,
                'seller_user_id' => $request->user()->id,
                'invoice_date' => now(),
                'payment_type' => null,
                'total_amount' => $order->total_amount,
                'amount_paid' => 0,
                'discount' => $order->discount,
                'vat_rate' => $order->vat_rate,
                'status' => 'unpaid',
                'comment' => "Commande {$order->number}",
            ]);

            foreach ($order->lines as $line) {
                $invoice->items()->create([
                    'service_id' => $line->service_id,
                    'label' => $line->label,
                    'unit_price' => $line->unit_price,
                    'quantity' => $line->quantity,
                    'line_total' => $line->line_total,
                ]);
            }

            $order->update(['status' => 'completed', 'invoice_id' => $invoice->id]);

            $this->logger->log(
                action: 'invoiced',
                entityType: 'order',
                entityId: $order->id,
                description: "Facture {$invoice->number} générée depuis la commande {$order->number}",
                newValues: ['invoice' => $invoice->number],
                request: $request,
            );

            return $invoice;
        });

        return response()->json(
            $invoice->fresh()->load(['items', 'commercial.user', 'client']),
            201
        );
    }

    #[OA\Post(
        path: '/api/orders/{order}/cancel',
        summary: 'Annuler une commande',
        tags: ['Commandes'],
        security: [['sanctum' => []]],
        parameters: [
            new OA\Parameter(name: 'order', in: 'path', required: true, schema: new OA\Schema(type: 'string', format: 'uuid')),
        ],
        responses: [
            new OA\Response(response: 200, description: 'Commande annulée'),
        ]
    )]
    public function cancel(Request $request, Order $order): JsonResponse
    {
        if (! in_array($order->status, ['draft', 'confirmed'], true)) {
            return response()->json(['message' => "Une commande {$order->status} ne peut pas être annulée."], 422);
        }

        $order->update(['status' => 'cancelled']);

        $this->logger->log(
            action: 'cancelled',
            entityType: 'order',
            entityId: $order->id,
            description: "Commande {$order->number} annulée",
            request: $request,
        );

        return response()->json($order->fresh()->load(['client', 'agency', 'lines']));
    }

    #[OA\Post(
        path: '/api/orders/{order}/submit',
        summary: 'Soumettre une commande en attente de validation (avec preuve de paiement)',
        tags: ['Commandes'],
        security: [['sanctum' => []]],
        responses: [
            new OA\Response(response: 200, description: 'Commande soumise'),
            new OA\Response(response: 422, description: 'Commande non soumettable'),
        ]
    )]
    public function submit(Request $request, Order $order): JsonResponse
    {
        if (! in_array($order->status, ['draft', 'confirmed'], true)) {
            return response()->json(['message' => "Une commande {$order->status} ne peut pas être soumise."], 422);
        }

        $data = $request->validate([
            'proof_path' => ['nullable', 'string', 'max:255'],
            'proof_url' => ['nullable', 'string', 'max:500'],
        ]);

        $order->update([
            'status' => 'pending_validation',
            'proof_path' => $data['proof_path'] ?? $order->proof_path,
            'proof_url' => $data['proof_url'] ?? $order->proof_url,
            'submitted_at' => now(),
        ]);

        $this->logger->log(
            'submitted',
            'order',
            $order->id,
            "Commande {$order->number} soumise pour validation",
            newValues: $order->only(['number', 'status']),
        );

        // Notifier les validateurs (caissières / responsables) en attente.
        $this->notifications->notifyByPermission(
            permissions: ['orders.valider'],
            title: 'Commande à valider',
            message: "La commande {$order->number} de {$order->total_amount} FCFA est en attente de validation.",
            link: "/orders/{$order->id}",
            type: 'order_due',
        );

        return response()->json($order->fresh()->load(['client', 'agency', 'lines']));
    }

    #[OA\Post(
        path: '/api/orders/{order}/validate',
        summary: 'Valider une commande soumise : génère la facture, encaisse le paiement et inscrit aux formations',
        tags: ['Commandes'],
        security: [['sanctum' => []]],
        responses: [
            new OA\Response(response: 200, description: 'Commande validée et facturée'),
            new OA\Response(response: 422, description: 'Commande non validable'),
        ]
    )]
    public function validateSubmission(Request $request, Order $order): JsonResponse
    {
        if ($order->status !== 'pending_validation') {
            return response()->json(['message' => "Seule une commande en attente de validation peut être validée (statut actuel : {$order->status})."], 422);
        }

        if ($order->invoice_id) {
            return response()->json(['message' => 'Une facture existe déjà pour cette commande.'], 422);
        }

        $data = $request->validate([
            'payment_method' => ['nullable', 'string', 'max:50'],
            'treasury_account_id' => ['nullable', 'uuid'],
            'paid_at' => ['nullable', 'date'],
            'note' => ['nullable', 'string'],
        ]);

        $invoice = DB::transaction(function () use ($order, $request, $data) {
            $client = $order->client;

            $invoice = Invoice::create([
                'number' => $this->invoiceNumber->next(),
                'agency_id' => $order->agency_id,
                'client_id' => $order->client_id,
                'client_name' => $client ? trim("{$client->first_name} {$client->last_name}") : null,
                'commercial_id' => $order->commercial_id,
                'seller_user_id' => $request->user()->id,
                'invoice_date' => now(),
                'payment_type' => $data['payment_method'] ?? null,
                'total_amount' => $order->total_amount,
                'amount_paid' => 0,
                'discount' => $order->discount,
                'vat_rate' => $order->vat_rate,
                'status' => 'unpaid',
                'comment' => "Commande {$order->number}",
            ]);

            foreach ($order->lines as $line) {
                $invoice->items()->create([
                    'service_id' => $line->service_id,
                    'label' => $line->label,
                    'unit_price' => $line->unit_price,
                    'quantity' => $line->quantity,
                    'line_total' => $line->line_total,
                ]);
            }

            // Inscriptions aux formations contenues dans la commande.
            $this->registerFormationEnrollmentsFromOrder($order, $invoice, $request);

            // Encaissement intégral (paiement validé par preuve).
            if ($order->total_amount > 0) {
                $this->paymentService->applyPayment(
                    invoice: $invoice,
                    amount: (float) $order->total_amount,
                    method: $data['payment_method'] ?? 'cash',
                    isAdvance: false,
                    userId: $request->user()->id,
                    treasuryAccountId: $data['treasury_account_id'] ?? null,
                    paidAt: $data['paid_at'] ?? null,
                );
            }

            $order->update([
                'status' => 'completed',
                'invoice_id' => $invoice->id,
                'validated_by' => $request->user()->id,
                'validated_at' => now(),
                'validation_note' => $data['note'] ?? null,
            ]);

            $this->logger->log(
                'validated',
                'order',
                $order->id,
                "Commande {$order->number} validée et facture {$invoice->number} encaissée",
                newValues: ['invoice' => $invoice->number],
            );

            return $invoice;
        });

        // Notifier le commercial vendeur que sa commande est validée.
        if ($order->commercial_id) {
            $commercial = $order->commercial;
            if ($commercial && $commercial->user_id) {
                $this->notifications->notifyUserIds(
                    userIds: [$commercial->user_id],
                    title: 'Commande validée',
                    message: "Votre commande {$order->number} a été validée. Facture {$invoice->number} encaissée.",
                    link: "/orders/{$order->id}",
                    type: 'order_validated',
                );
            }
        }

        return response()->json(
            $invoice->fresh()->load(['items', 'payments', 'client', 'commercial', 'agency']),
            201
        );
    }

    #[OA\Post(
        path: '/api/orders/{order}/decline',
        summary: 'Refuser une commande soumise (retour en brouillon avec motif)',
        tags: ['Commandes'],
        security: [['sanctum' => []]],
        responses: [
            new OA\Response(response: 200, description: 'Commande refusée'),
            new OA\Response(response: 422, description: 'Commande non réfusable'),
        ]
    )]
    public function decline(Request $request, Order $order): JsonResponse
    {
        if ($order->status !== 'pending_validation') {
            return response()->json(['message' => "Seule une commande en attente de validation peut être refusée (statut actuel : {$order->status})."], 422);
        }

        $data = $request->validate([
            'note' => ['nullable', 'string', 'max:1000'],
        ]);

        $order->update([
            'status' => 'draft',
            'validated_by' => $request->user()->id,
            'validated_at' => now(),
            'validation_note' => $data['note'] ?? null,
        ]);

        $this->logger->log(
            'declined',
            'order',
            $order->id,
            "Commande {$order->number} refusée : " . ($data['note'] ?? 'aucun motif'),
            request: $request,
        );

        if ($order->commercial_id) {
            $commercial = $order->commercial;
            if ($commercial && $commercial->user_id) {
                $this->notifications->notifyUserIds(
                    userIds: [$commercial->user_id],
                    title: 'Commande refusée',
                    message: "Votre commande {$order->number} a été refusée : " . ($data['note'] ?? 'aucun motif précisé.'),
                    link: "/orders/{$order->id}",
                    type: 'order_declined',
                );
            }
        }

        return response()->json($order->fresh()->load(['client', 'agency', 'lines']));
    }

    private function validateOrder(Request $request, bool $update = false): array
    {
        return $request->validate([
            'client_id' => [$update ? 'sometimes' : 'required', 'uuid', 'exists:users,id'],
            'agency_id' => ['nullable', 'uuid', 'exists:agencies,id'],
            'commercial_id' => ['nullable', 'uuid', 'exists:commercials,id'],
            'order_date' => ['nullable', 'date'],
            'status' => ['nullable', 'in:draft,confirmed,cancelled'],
            'discount' => ['nullable', 'numeric', 'min:0'],
            'vat_rate' => ['nullable', 'numeric', 'min:0', 'max:100'],
            'notes' => ['nullable', 'string'],
            'lines' => $update ? ['sometimes', 'array', 'min:1'] : ['required', 'array', 'min:1'],
            'lines.*.line_type' => ['nullable', 'in:catalog,manual'],
            'lines.*.service_id' => ['required_if:lines.*.line_type,catalog', 'nullable', 'uuid', 'exists:services,id'],
            'lines.*.label' => ['required_if:lines.*.line_type,manual', 'nullable', 'string', 'max:255'],
            'lines.*.description' => ['nullable', 'string'],
            'lines.*.unit_price' => ['required_if:lines.*.line_type,manual', 'nullable', 'numeric', 'min:0'],
            'lines.*.quantity' => ['nullable', 'integer', 'min:1', 'max:9999'],
        ]);
    }

    /**
     * Construit les lignes avec snapshot du prix : catalogue = prix du service
     * (surchargeable), manuel = prix saisi. Les occurrences multiples d'un même
     * service sont autorisées.
     */
    private function buildLines(array $lines): array
    {
        $result = [];

        foreach ($lines as $line) {
            $type = $line['line_type'] ?? 'catalog';
            $quantity = (int) ($line['quantity'] ?? 1);

            $unitPrice = null;
            $label = null;
            $serviceId = null;

            if ($type === 'catalog' && ! empty($line['service_id'])) {
                $service = Service::findOrFail($line['service_id']);
                $serviceId = $service->id;
                $label = $service->name;
                $unitPrice = array_key_exists('unit_price', $line) && $line['unit_price'] !== null
                    ? (float) $line['unit_price']
                    : (float) $service->price;
            } else {
                $label = $line['label'];
                $unitPrice = (float) $line['unit_price'];
            }

            $unitPrice = round(max(0, $unitPrice), 2);

            $result[] = [
                'line_type' => $type,
                'service_id' => $serviceId,
                'label' => $label,
                'description' => $line['description'] ?? null,
                'unit_price' => $unitPrice,
                'quantity' => $quantity,
                'line_total' => round($unitPrice * $quantity, 2),
            ];
        }

        return $result;
    }

    private function registerFormationEnrollmentsFromOrder(Order $order, Invoice $invoice, Request $request): void
    {
        $clientId = $order->client_id;

        if (! $clientId) {
            return;
        }

        foreach ($order->lines as $line) {
            if (! $line->service_id) {
                continue;
            }

            $service = Service::find($line->service_id);

            if (! $service || $service->type !== 'formation' || ! $service->course_id) {
                continue;
            }

            $courseId = $service->course_id;

            $existing = FormationEnrollment::where('course_id', $courseId)
                ->where('learner_user_id', $clientId)
                ->first();

            if ($existing && $existing->status !== 'cancelled') {
                $existing->update([
                    'invoice_id' => $invoice->id,
                    'status' => 'enrolled',
                    'enrolled_at' => now(),
                    'amount_paid' => (float) $line->unit_price * (int) $line->quantity,
                ]);
            } else {
                FormationEnrollment::create([
                    'course_id' => $courseId,
                    'learner_user_id' => $clientId,
                    'invoice_id' => $invoice->id,
                    'seller_user_id' => $order->commercial_id ? $order->commercial->user_id : $request->user()->id,
                    'enrolled_at' => now(),
                    'status' => 'enrolled',
                    'amount_paid' => (float) $line->unit_price * (int) $line->quantity,
                    'notes' => "Validée depuis la commande {$order->number}",
                ]);
            }
        }
    }
}