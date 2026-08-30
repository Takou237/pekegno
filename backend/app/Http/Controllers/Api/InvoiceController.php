<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Http\Requests\Api\StoreInvoicePaymentRequest;
use App\Http\Requests\Api\StoreInvoiceRequest;
use App\Http\Requests\Api\UpdateInvoiceRequest;
use App\Models\FormationEnrollment;
use App\Models\Invoice;
use App\Models\Service;
use App\Services\AccountingService;
use App\Services\ActivityLogger;
use App\Services\CommissionService;
use App\Services\InvoiceNumberGenerator;
use App\Services\PaymentService;
use App\Services\PointsService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;
use Illuminate\Validation\ValidationException;
use OpenApi\Attributes as OA;

class InvoiceController extends Controller
{
    public function __construct(
        private readonly InvoiceNumberGenerator $numberGenerator,
        private readonly PointsService $pointsService,
        private readonly CommissionService $commissionService,
        private readonly AccountingService $accountingService,
        private readonly PaymentService $paymentService,
        private readonly ActivityLogger $logger,
        private readonly \App\Services\SellerProfileService $sellerProfiles,
    ) {}

    #[OA\Get(
        path: '/api/invoices',
        summary: 'Lister les factures avec filtres, pagination et totaux',
        tags: ['Factures'],
        security: [['sanctum' => []]],
        parameters: [
            new OA\Parameter(name: 'search', in: 'query', description: 'Recherche par numéro, nom client ou email client', schema: new OA\Schema(type: 'string')),
            new OA\Parameter(name: 'status', in: 'query', description: 'Filtrer par statut', schema: new OA\Schema(type: 'string', enum: ['unpaid', 'partial', 'paid'])),
            new OA\Parameter(name: 'agency_id', in: 'query', schema: new OA\Schema(type: 'string', format: 'uuid')),
            new OA\Parameter(name: 'client_id', in: 'query', schema: new OA\Schema(type: 'string', format: 'uuid')),
            new OA\Parameter(name: 'commercial_id', in: 'query', schema: new OA\Schema(type: 'string', format: 'uuid')),
            new OA\Parameter(name: 'from', in: 'query', description: 'Date début (Y-m-d)', schema: new OA\Schema(type: 'string', format: 'date')),
            new OA\Parameter(name: 'to', in: 'query', description: 'Date fin (Y-m-d)', schema: new OA\Schema(type: 'string', format: 'date')),
            new OA\Parameter(name: 'include_cancelled', in: 'query', description: 'Inclure les factures annulées', schema: new OA\Schema(type: 'boolean', default: false)),
            new OA\Parameter(name: 'per_page', in: 'query', schema: new OA\Schema(type: 'integer', default: 15)),
        ],
        responses: [
            new OA\Response(response: 200, description: 'Liste paginée + totaux (revenue, outstanding, advances)'),
        ]
    )]
    public function index(Request $request): JsonResponse
    {
        $base = Invoice::query()
            ->when($request->boolean('from_enrollments'), fn ($q) => $q->whereIn(
                'invoices.id',
                FormationEnrollment::query()->whereNotNull('invoice_id')->pluck('invoice_id')
            ))
            ->when($request->search, fn ($q, $s) => $q->where(function ($q) use ($s) {
                $q->where('number', 'like', "%{$s}%")
                    ->when(Schema::hasColumn('invoices', 'client_name'), fn ($q) => $q->orWhere('client_name', 'like', "%{$s}%"))
                    ->orWhereHas('client', fn ($c) => $c->where('first_name', 'like', "%{$s}%")
                        ->orWhere('last_name', 'like', "%{$s}%")
                        ->orWhere('email', 'like', "%{$s}%"));
            }))
            ->when($request->status, function ($q, $s) {
                $statuses = array_values(array_filter(array_map('trim', explode(',', (string) $s))));
                $q->whereIn('status', $statuses);
            })
            ->when($request->agency_id, fn ($q, $id) => $q->where('agency_id', $id))
            ->when($request->client_id, fn ($q, $id) => $q->where('client_id', $id))
            ->when($request->commercial_id, fn ($q, $id) => $q->where('commercial_id', $id))
            ->when($request->from, fn ($q, $d) => $q->whereDate('invoice_date', '>=', $d))
            ->when($request->to, fn ($q, $d) => $q->whereDate('invoice_date', '<=', $d))
            ->when(! $request->boolean('include_cancelled'), fn ($q) => $q->whereNull('cancelled_at'));

        $totals = (clone $base)->selectRaw(
            'coalesce(sum(amount_paid), 0) as revenue, '
            ."coalesce(sum(case when status in ('unpaid','partial') then total_amount - amount_paid else 0 end), 0) as outstanding"
        )->first();

        $advances = (clone $base)
            ->whereIn('status', ['unpaid', 'partial'])
            ->join('invoice_payments', 'invoice_payments.invoice_id', '=', 'invoices.id')
            ->where('invoice_payments.is_advance', true)
            ->sum('invoice_payments.amount');

        $perPage = min((int) $request->input('per_page', 15), 100);

        $invoices = $base
            ->with(['client:id,first_name,last_name,email,client_number,phone', 'commercial:id,first_name,last_name,email,phone', 'agency:id,name,code,city,address,phone,email'])
            ->orderByDesc('invoice_date')
            ->paginate($perPage);

        return response()->json([
            'invoices' => $invoices,
            'totals' => [
                'revenue' => (float) $totals->revenue,
                'outstanding' => (float) $totals->outstanding,
                'advances' => (float) $advances,
            ],
        ]);
    }

    #[OA\Post(
        path: '/api/invoices',
        summary: 'Créer une facture (lignes + avance éventuelle)',
        tags: ['Factures'],
        security: [['sanctum' => []]],
        responses: [
            new OA\Response(response: 201, description: 'Facture créée'),
            new OA\Response(response: 422, description: 'Validation échouée'),
        ]
    )]
    public function store(StoreInvoiceRequest $request): JsonResponse
    {
        $data = $request->validated();

        $invoice = DB::transaction(function () use ($data, $request) {
            $items = collect($data['items'])->map(function (array $line) {
                $service = isset($line['service_id']) ? Service::find($line['service_id']) : null;

                $passTier = $line['pass_tier'] ?? null;
                $pass = null;

                if ($passTier) {
                    if (! $service || ! $service->is_seminar) {
                        throw ValidationException::withMessages([
                            'items' => 'Un pass séminaire ne peut être choisi que pour un service séminaire.',
                        ]);
                    }

                    $pass = $service->seminarTiers()->where('tier', $passTier)->first();

                    if (! $pass) {
                        throw ValidationException::withMessages([
                            'items' => "Le pass {$passTier} n'existe pas pour ce séminaire.",
                        ]);
                    }
                }

                return [
                    'service_id' => $service?->id,
                    'label' => $line['label'] ?? $service?->name,
                    'unit_price' => $pass ? (float) $pass->price : (float) ($line['unit_price'] ?? $service?->effective_price ?? 0),
                    'quantity' => (int) $line['quantity'],
                    'pass_tier' => $pass?->tier,
                    'pass_label' => $pass?->label,
                ];
            });

            $subtotal = round($items->sum(fn ($l) => $l['unit_price'] * $l['quantity']), 2);

            $discount = round((float) ($data['discount'] ?? 0), 2);
            if ($discount < 0 || $discount > $subtotal) {
                throw ValidationException::withMessages([
                    'discount' => 'La remise ne peut pas dépasser le montant total de la facture.',
                ]);
            }

            $vatRate = round((float) ($data['vat_rate'] ?? 0), 2);
            $afterDiscount = max(0, $subtotal - $discount);
            $vatAmount = round($afterDiscount * ($vatRate / 100), 2);
            $total = round($afterDiscount + $vatAmount, 2);

            if (! empty($data['advance']) && (float) $data['advance'] > $total) {
                throw ValidationException::withMessages([
                    'advance' => "L'avance ne peut pas dépasser le total de la facture ({$total} FCFA).",
                ]);
            }

            $invoice = Invoice::create([
                'number' => $this->numberGenerator->next(),
                'agency_id' => $data['agency_id'] ?? $request->user()->primaryAgency()->value('agencies.id'),
                'client_id' => $data['client_id'] ?? null,
                'client_name' => $data['client_name'] ?? null,
                'commercial_id' => $data['commercial_id'] ?? null,
                'seller_user_id' => $data['seller_user_id'] ?? $request->user()->id,
                'invoice_date' => $data['invoice_date'] ?? now(),
                'payment_type' => $data['payment_type'] ?? null,
                'total_amount' => $total,
                'amount_paid' => 0,
                'discount' => $discount,
                'vat_rate' => $vatRate,
                'status' => 'unpaid',
                'comment' => $data['comment'] ?? null,
            ]);

            // Un vendeur formateur (employé de l'agence) obtient son profil vendeur
            // à la première vente, sans inventer de taux (commission_type=none).
            if (($data['seller_user_id'] ?? null) && $data['seller_user_id'] !== $request->user()->id) {
                $seller = \App\Models\User::find($data['seller_user_id']);
                if ($seller) {
                    $this->sellerProfiles->ensureForUser($seller, $invoice->agency_id);
                }
            } else {
                $this->sellerProfiles->ensureForUser($request->user(), $invoice->agency_id);
            }

            foreach ($items as $line) {
                $invoice->items()->create([
                    'service_id' => $line['service_id'],
                    'label' => $line['label'],
                    'unit_price' => $line['unit_price'],
                    'quantity' => $line['quantity'],
                    'line_total' => round($line['unit_price'] * $line['quantity'], 2),
                    'pass_tier' => $line['pass_tier'],
                    'pass_label' => $line['pass_label'],
                ]);
            }

            if (! empty($data['advance'])) {
                $this->applyPayment($invoice, (float) $data['advance'], $data['payment_type'] ?? 'cash', true, $request->user()->id);
            }

            $this->logger->log(
                'created',
                'invoice',
                $invoice->id,
                "Facture {$invoice->number} créée ({$total} FCFA)",
                newValues: $invoice->only(['number', 'total_amount', 'status']),
            );

            return $invoice;
        });

        return response()->json($invoice->fresh()->load(['items', 'payments', 'client', 'commercial', 'agency', 'seller']), 201);
    }

    #[OA\Get(
        path: '/api/invoices/{invoice}',
        summary: 'Détail d\'une facture (lignes, paiements, solde)',
        tags: ['Factures'],
        security: [['sanctum' => []]],
        parameters: [
            new OA\Parameter(name: 'invoice', in: 'path', required: true, schema: new OA\Schema(type: 'string', format: 'uuid')),
        ],
        responses: [
            new OA\Response(response: 200, description: 'Détail de la facture'),
        ]
    )]
    public function show(Invoice $invoice): JsonResponse
    {
        $invoice->load(['items', 'payments', 'commissionPayments', 'client', 'commercial', 'agency', 'seller']);

        return response()->json($invoice);
    }

    #[OA\Put(
        path: '/api/invoices/{invoice}',
        summary: 'Modifier les informations d\'une facture (client, commercial, type de paiement, commentaire)',
        tags: ['Factures'],
        security: [['sanctum' => []]],
        parameters: [
            new OA\Parameter(name: 'invoice', in: 'path', required: true, schema: new OA\Schema(type: 'string', format: 'uuid')),
        ],
        responses: [
            new OA\Response(response: 200, description: 'Facture modifiée'),
        ]
    )]
    public function update(UpdateInvoiceRequest $request, Invoice $invoice): JsonResponse
    {
        abort_if($invoice->is_cancelled, 422, 'Impossible de modifier une facture annulée.');

        $old = $invoice->only(['client_id', 'client_name', 'commercial_id', 'payment_type', 'comment']);
        $invoice->update($request->only(['client_id', 'client_name', 'commercial_id', 'payment_type', 'comment']));

        $this->logger->log(
            'updated',
            'invoice',
            $invoice->id,
            "Facture {$invoice->number} modifiée",
            oldValues: $old,
            newValues: $invoice->only(['client_id', 'client_name', 'commercial_id', 'payment_type', 'comment']),
        );

        return response()->json($invoice->fresh()->load(['items', 'payments', 'client', 'commercial', 'agency']));
    }

    #[OA\Post(
        path: '/api/invoices/{invoice}/payments',
        summary: 'Encaisser un paiement (statut recalculé, points/commission si soldée)',
        tags: ['Factures'],
        security: [['sanctum' => []]],
        parameters: [
            new OA\Parameter(name: 'invoice', in: 'path', required: true, schema: new OA\Schema(type: 'string', format: 'uuid')),
        ],
        responses: [
            new OA\Response(response: 200, description: 'Paiement enregistré'),
            new OA\Response(response: 422, description: 'Montant invalide, facture annulée ou déjà soldée'),
        ]
    )]
    public function pay(StoreInvoicePaymentRequest $request, Invoice $invoice): JsonResponse
    {
        abort_if($invoice->is_cancelled, 422, "Impossible d'encaisser une facture annulée.");
        abort_if($invoice->status === 'paid', 422, 'Cette facture est déjà soldée.');

        $amount = round((float) $request->input('amount'), 2);
        if ($amount > $invoice->balance_due) {
            return response()->json([
                'message' => "Le montant dépasse le reste à payer ({$invoice->balance_due} FCFA).",
            ], 422);
        }

        $this->paymentService->applyPayment(
            invoice: $invoice,
            amount: $amount,
            method: $request->input('payment_method'),
            isAdvance: $request->boolean('is_advance', false),
            userId: $request->user()->id,
            treasuryAccountId: $request->input('treasury_account_id'),
            paidAt: $request->input('paid_at'),
        );

        $this->logger->log(
            'paid',
            'invoice',
            $invoice->id,
            "Paiement de {$amount} FCFA ({$request->input('payment_method')}) sur la facture {$invoice->number}",
        );

        return response()->json($invoice->fresh()->load(['items', 'payments', 'client', 'commercial', 'agency']));
    }

    #[OA\Post(
        path: '/api/invoices/{invoice}/cancel',
        summary: 'Annuler une facture (exclue des statistiques)',
        tags: ['Factures'],
        security: [['sanctum' => []]],
        parameters: [
            new OA\Parameter(name: 'invoice', in: 'path', required: true, schema: new OA\Schema(type: 'string', format: 'uuid')),
        ],
        responses: [
            new OA\Response(response: 200, description: 'Facture annulée'),
        ]
    )]
    public function cancel(Invoice $invoice): JsonResponse
    {
        abort_if($invoice->is_cancelled, 422, 'Cette facture est déjà annulée.');

        $invoice->update(['cancelled_at' => now()]);
        $invoice->refreshStatus();
        $invoice->save();

        $this->logger->log('cancelled', 'invoice', $invoice->id, "Facture {$invoice->number} annulée");

        return response()->json($invoice->fresh()->load(['items', 'payments', 'client', 'commercial', 'agency']));
    }

    private function applyPayment(Invoice $invoice, float $amount, string $method, bool $isAdvance, string $userId): void
    {
        $this->paymentService->applyPayment($invoice, $amount, $method, $isAdvance, $userId);
    }
}
