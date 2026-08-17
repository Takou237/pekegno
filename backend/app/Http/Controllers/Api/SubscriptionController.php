<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Invoice;
use App\Models\Subscription;
use App\Models\SubscriptionPack;
use App\Models\SubscriptionPackService;
use App\Models\User;
use App\Services\ActivityLogger;
use App\Services\InvoiceNumberGenerator;
use App\Services\PaymentService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;
use OpenApi\Attributes as OA;

class SubscriptionController extends Controller
{
    public function __construct(
        private readonly InvoiceNumberGenerator $numberGenerator,
        private readonly PaymentService $paymentService,
        private readonly ActivityLogger $logger,
    ) {}

    #[OA\Get(
        path: '/api/subscription-packs',
        summary: 'Lister les packs d\'abonnement',
        tags: ['Abonnements'],
        security: [['sanctum' => []]],
        responses: [
            new OA\Response(response: 200, description: 'Liste des packs'),
        ]
    )]
    public function packsIndex(Request $request): JsonResponse
    {
        $packs = SubscriptionPack::with('packServices.service', 'agency:id,name')
            ->when($request->agency_id, fn ($q, $id) => $q->where('agency_id', $id))
            ->when($request->filled('is_active'), fn ($q) => $q->where('is_active', $request->boolean('is_active')))
            ->orderBy('name')
            ->paginate(min((int) $request->input('per_page', 15), 100));

        return response()->json($packs);
    }

    #[OA\Post(
        path: '/api/subscription-packs',
        summary: 'Créer un pack d\'abonnement (services + prix mensuel)',
        tags: ['Abonnements'],
        security: [['sanctum' => []]],
        responses: [
            new OA\Response(response: 201, description: 'Pack créé'),
            new OA\Response(response: 422, description: 'Validation échouée'),
        ]
    )]
    public function packsStore(Request $request): JsonResponse
    {
        $data = $this->validatePack($request);

        $pack = DB::transaction(function () use ($data, $request) {
            $pack = SubscriptionPack::create([
                'agency_id' => $data['agency_id'] ?? $request->user()->agency_id,
                'name' => $data['name'],
                'description' => $data['description'] ?? null,
                'price_per_month' => $data['price_per_month'],
                'is_active' => $data['is_active'] ?? true,
            ]);

            $this->createPackServices($pack, $data['services']);

            $this->logger->log(
                action: 'created',
                entityType: 'subscription-pack',
                entityId: $pack->id,
                description: "Pack d'abonnement {$pack->name} créé",
                newValues: ['name' => $pack->name],
                request: $request,
            );

            return $pack;
        });

        return response()->json($pack->fresh()->load('packServices.service'), 201);
    }

    #[OA\Put(
        path: '/api/subscription-packs/{pack}',
        summary: 'Modifier un pack d\'abonnement',
        tags: ['Abonnements'],
        security: [['sanctum' => []]],
        parameters: [
            new OA\Parameter(name: 'pack', in: 'path', required: true, schema: new OA\Schema(type: 'string', format: 'uuid')),
        ],
        responses: [
            new OA\Response(response: 200, description: 'Pack modifié'),
        ]
    )]
    public function packsUpdate(Request $request, SubscriptionPack $pack): JsonResponse
    {
        $data = $this->validatePack($request, update: true);

        DB::transaction(function () use ($pack, $data, $request) {
            $pack->update([
                'name' => $data['name'] ?? $pack->name,
                'description' => array_key_exists('description', $data) ? $data['description'] : $pack->description,
                'price_per_month' => $data['price_per_month'] ?? $pack->price_per_month,
                'is_active' => $data['is_active'] ?? $pack->is_active,
            ]);

            if (isset($data['services'])) {
                $pack->packServices()->delete();
                $this->createPackServices($pack, $data['services']);
            }

            $this->logger->log(
                action: 'updated',
                entityType: 'subscription-pack',
                entityId: $pack->id,
                description: "Pack d'abonnement {$pack->name} modifié",
                oldValues: ['name' => $pack->name],
                newValues: ['name' => $pack->name],
                request: $request,
            );
        });

        return response()->json($pack->fresh()->load('packServices.service'));
    }

    #[OA\Delete(
        path: '/api/subscription-packs/{pack}',
        summary: 'Supprimer un pack d\'abonnement',
        tags: ['Abonnements'],
        security: [['sanctum' => []]],
        parameters: [
            new OA\Parameter(name: 'pack', in: 'path', required: true, schema: new OA\Schema(type: 'string', format: 'uuid')),
        ],
        responses: [
            new OA\Response(response: 204, description: 'Pack supprimé'),
        ]
    )]
    public function packsDestroy(Request $request, SubscriptionPack $pack): JsonResponse
    {
        $name = $pack->name;

        $pack->delete();

        $this->logger->log(
            action: 'deleted',
            entityType: 'subscription-pack',
            entityId: $pack->id,
            description: "Pack d'abonnement {$name} supprimé",
            request: $request,
        );

        return response()->json(null, 204);
    }

    #[OA\Get(
        path: '/api/subscriptions',
        summary: 'Lister les abonnements (filtres agence/client/statut)',
        tags: ['Abonnements'],
        security: [['sanctum' => []]],
        parameters: [
            new OA\Parameter(name: 'agency_id', in: 'query', schema: new OA\Schema(type: 'string', format: 'uuid')),
            new OA\Parameter(name: 'client_id', in: 'query', schema: new OA\Schema(type: 'string', format: 'uuid')),
            new OA\Parameter(name: 'pack_id', in: 'query', schema: new OA\Schema(type: 'string', format: 'uuid')),
            new OA\Parameter(name: 'status', in: 'query', schema: new OA\Schema(type: 'string', enum: ['unpaid', 'partial', 'paid', 'cancelled'])),
            new OA\Parameter(name: 'per_page', in: 'query', schema: new OA\Schema(type: 'integer', default: 15)),
        ],
        responses: [
            new OA\Response(response: 200, description: 'Liste paginée des abonnements'),
        ]
    )]
    public function index(Request $request): JsonResponse
    {
        $subscriptions = Subscription::query()
            ->with('pack', 'agency:id,name', 'client:id,first_name,last_name,email', 'invoice')
            ->when($request->agency_id, fn ($q, $id) => $q->where('agency_id', $id))
            ->when($request->client_id, fn ($q, $id) => $q->where('client_id', $id))
            ->when($request->pack_id, fn ($q, $id) => $q->where('subscription_pack_id', $id))
            ->when($request->status, function ($q, $status) {
                $q->whereHas('invoice', fn ($i) => $status === 'cancelled'
                    ? $i->whereNotNull('cancelled_at')
                    : $i->whereNull('cancelled_at')->where('status', $status));
            })
            ->orderByDesc('start_date')
            ->paginate(min((int) $request->input('per_page', 15), 100));

        return response()->json($subscriptions);
    }

    #[OA\Post(
        path: '/api/subscriptions',
        summary: 'Créer un abonnement → génère automatiquement la facture',
        tags: ['Abonnements'],
        security: [['sanctum' => []]],
        responses: [
            new OA\Response(response: 201, description: 'Abonnement + facture créés'),
            new OA\Response(response: 422, description: 'Validation échouée'),
        ]
    )]
    public function store(Request $request): JsonResponse
    {
        $data = $request->validate([
            'subscription_pack_id' => ['required', 'uuid', 'exists:subscription_packs,id'],
            'client_id' => ['required', 'uuid', 'exists:users,id'],
            'months' => ['required', 'integer', 'min:1', 'max:60'],
            'start_date' => ['nullable', 'date'],
            'advance' => ['nullable', 'numeric', 'min:0.01'],
            'payment_type' => ['nullable', 'in:cash,mobile'],
        ]);

        $pack = SubscriptionPack::with('packServices.service')->findOrFail($data['subscription_pack_id']);
        if (! $pack->is_active) {
            return response()->json(['message' => "Ce pack d'abonnement est inactif."], 422);
        }

        $client = User::findOrFail($data['client_id']);
        if ($client->role?->name !== 'client') {
            return response()->json(['message' => 'Le client lié doit avoir le rôle client.'], 422);
        }

        $start = Carbon::parse($data['start_date'] ?? now()->toDateString());
        $pricePerMonth = (float) $pack->price_per_month;
        $total = round($pricePerMonth * (int) $data['months'], 2);

        if (! empty($data['advance']) && (float) $data['advance'] > $total) {
            throw ValidationException::withMessages([
                'advance' => "L'avance ne peut pas dépasser le total de l'abonnement ({$total} FCFA).",
            ]);
        }

        $subscription = DB::transaction(function () use ($pack, $data, $client, $start, $pricePerMonth, $total, $request) {
            $invoice = $this->buildInvoice($pack, $client, $start, (int) $data['months'], $pricePerMonth, $total, $request);

            $subscription = Subscription::create([
                'subscription_pack_id' => $pack->id,
                'agency_id' => $pack->agency_id,
                'client_id' => $client->id,
                'months' => (int) $data['months'],
                'price_per_month' => $pricePerMonth,
                'total_price' => $total,
                'start_date' => $start->toDateString(),
                'end_date' => $start->copy()->addMonths((int) $data['months'])->toDateString(),
                'invoice_id' => $invoice->id,
            ]);

            if (! empty($data['advance'])) {
                $this->paymentService->applyPayment($invoice, (float) $data['advance'], $data['payment_type'] ?? 'cash', true, $request->user()->id);
            }

            $this->logger->log(
                action: 'created',
                entityType: 'subscription',
                entityId: $subscription->id,
                description: "Abonnement {$pack->name} ({$data['months']} mois) pour {$client->first_name} {$client->last_name} — facture {$invoice->number}",
                newValues: ['total' => $total, 'invoice' => $invoice->number],
                request: $request,
            );

            return $subscription;
        });

        return response()->json(
            $subscription->fresh()->load(['pack', 'agency', 'client', 'invoice.items', 'invoice.payments']),
            201
        );
    }

    #[OA\Post(
        path: '/api/subscriptions/{subscription}/renew',
        summary: 'Renouveler un abonnement → crée une nouvelle facture pour la période suivante',
        tags: ['Abonnements'],
        security: [['sanctum' => []]],
        parameters: [
            new OA\Parameter(name: 'subscription', in: 'path', required: true, schema: new OA\Schema(type: 'string', format: 'uuid')),
        ],
        responses: [
            new OA\Response(response: 201, description: 'Nouvel abonnement + facture créés'),
        ]
    )]
    public function renew(Request $request, Subscription $subscription): JsonResponse
    {
        $data = $request->validate([
            'months' => ['nullable', 'integer', 'min:1', 'max:60'],
            'advance' => ['nullable', 'numeric', 'min:0.01'],
            'payment_type' => ['nullable', 'in:cash,mobile'],
        ]);

        $pack = $subscription->pack()->with('packServices.service')->firstOrFail();
        if (! $pack->is_active) {
            return response()->json(['message' => "Ce pack d'abonnement est inactif."], 422);
        }

        $client = $subscription->client;
        $months = (int) ($data['months'] ?? $subscription->months);
        $start = Carbon::parse($subscription->end_date)->addDay();
        $total = round($subscription->price_per_month * $months, 2);

        if (! empty($data['advance']) && (float) $data['advance'] > $total) {
            throw ValidationException::withMessages([
                'advance' => "L'avance ne peut pas dépasser le total de l'abonnement ({$total} FCFA).",
            ]);
        }

        $newSubscription = DB::transaction(function () use ($pack, $client, $start, $months, $total, $subscription, $data, $request) {
            $invoice = $this->buildInvoice($pack, $client, $start, $months, $subscription->price_per_month, $total, $request);

            $new = Subscription::create([
                'subscription_pack_id' => $pack->id,
                'agency_id' => $pack->agency_id,
                'client_id' => $client->id,
                'months' => $months,
                'price_per_month' => $subscription->price_per_month,
                'total_price' => $total,
                'start_date' => $start->toDateString(),
                'end_date' => $start->copy()->addMonths($months)->toDateString(),
                'invoice_id' => $invoice->id,
            ]);

            if (! empty($data['advance'])) {
                $this->paymentService->applyPayment($invoice, (float) $data['advance'], $data['payment_type'] ?? 'cash', true, $request->user()->id);
            }

            $this->logger->log(
                action: 'renewed',
                entityType: 'subscription',
                entityId: $new->id,
                description: "Abonnement {$pack->name} renouvelé pour {$client->first_name} {$client->last_name} — facture {$invoice->number}",
                oldValues: ['subscription' => $subscription->id],
                newValues: ['invoice' => $invoice->number],
                request: $request,
            );

            return $new;
        });

        return response()->json(
            $newSubscription->fresh()->load(['pack', 'agency', 'client', 'invoice.items', 'invoice.payments']),
            201
        );
    }

    #[OA\Get(
        path: '/api/subscriptions/{subscription}',
        summary: 'Détail d\'un abonnement',
        tags: ['Abonnements'],
        security: [['sanctum' => []]],
        parameters: [
            new OA\Parameter(name: 'subscription', in: 'path', required: true, schema: new OA\Schema(type: 'string', format: 'uuid')),
        ],
        responses: [
            new OA\Response(response: 200, description: 'Détail de l\'abonnement'),
        ]
    )]
    public function show(Subscription $subscription): JsonResponse
    {
        $subscription->load(['pack.packServices.service', 'agency', 'client', 'invoice.items', 'invoice.payments']);

        return response()->json($subscription);
    }

    #[OA\Delete(
        path: '/api/subscriptions/{subscription}',
        summary: 'Supprimer un abonnement',
        tags: ['Abonnements'],
        security: [['sanctum' => []]],
        parameters: [
            new OA\Parameter(name: 'subscription', in: 'path', required: true, schema: new OA\Schema(type: 'string', format: 'uuid')),
        ],
        responses: [
            new OA\Response(response: 204, description: 'Abonnement supprimé'),
        ]
    )]
    public function destroy(Request $request, Subscription $subscription): JsonResponse
    {
        $name = $subscription->pack?->name ?? 'Abonnement';

        $subscription->delete();

        $this->logger->log(
            action: 'deleted',
            entityType: 'subscription',
            entityId: $subscription->id,
            description: "Abonnement {$name} supprimé",
            request: $request,
        );

        return response()->json(null, 204);
    }

    private function validatePack(Request $request, bool $update = false): array
    {
        $rules = [
            'agency_id' => ['nullable', 'exists:agencies,id'],
            'name' => ['required', 'string', 'max:255'],
            'description' => ['nullable', 'string', 'max:2000'],
            'price_per_month' => ['required', 'numeric', 'min:0'],
            'is_active' => ['sometimes', 'boolean'],
            'services' => $update ? ['sometimes', 'array'] : ['required', 'array'],
            'services.*.service_id' => ['required', 'uuid', 'exists:services,id'],
        ];

        $data = $request->validate($rules);

        if (isset($data['services'])) {
            $ids = array_column($data['services'], 'service_id');

            if (count(array_unique($ids)) !== count($ids)) {
                throw ValidationException::withMessages([
                    'services' => 'Les services du pack doivent être différents.',
                ]);
            }
        }

        return $data;
    }

    private function createPackServices(SubscriptionPack $pack, array $services): void
    {
        foreach ($services as $service) {
            SubscriptionPackService::create([
                'subscription_pack_id' => $pack->id,
                'service_id' => $service['service_id'],
                'price_per_month' => $pack->price_per_month,
            ]);
        }
    }

    private function buildInvoice(
        SubscriptionPack $pack,
        User $client,
        Carbon $start,
        int $months,
        float $pricePerMonth,
        float $total,
        Request $request,
    ): Invoice {
        $invoice = Invoice::create([
            'number' => $this->numberGenerator->next(),
            'agency_id' => $pack->agency_id,
            'client_id' => $client->id,
            'client_name' => $client->first_name.' '.$client->last_name,
            'seller_user_id' => $request->user()->id,
            'invoice_date' => now(),
            'payment_type' => null,
            'total_amount' => $total,
            'amount_paid' => 0,
            'discount' => 0,
            'vat_rate' => 0,
            'status' => 'unpaid',
            'comment' => "Abonnement {$pack->name} — {$months} mois (début {$start->format('Y-m-d')})",
        ]);

        foreach ($pack->packServices as $line) {
            $invoice->items()->create([
                'service_id' => $line->service_id,
                'label' => $line->service?->name ?? 'Service',
                'unit_price' => $pricePerMonth,
                'quantity' => $months,
                'line_total' => round($pricePerMonth * $months, 2),
            ]);
        }

        return $invoice;
    }
}
