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
        summary: 'Lister les abonnements (filtres client/pays/ville/agence/pack/statut/dates)',
        tags: ['Abonnements'],
        security: [['sanctum' => []]],
        parameters: [
            new OA\Parameter(name: 'agency_id', in: 'query', schema: new OA\Schema(type: 'string', format: 'uuid')),
            new OA\Parameter(name: 'client_id', in: 'query', schema: new OA\Schema(type: 'string', format: 'uuid')),
            new OA\Parameter(name: 'pack_id', in: 'query', schema: new OA\Schema(type: 'string', format: 'uuid')),
            new OA\Parameter(name: 'country_id', in: 'query', schema: new OA\Schema(type: 'string', format: 'uuid')),
            new OA\Parameter(name: 'city_id', in: 'query', schema: new OA\Schema(type: 'string', format: 'uuid')),
            new OA\Parameter(name: 'commercial_id', in: 'query', schema: new OA\Schema(type: 'string', format: 'uuid')),
            new OA\Parameter(name: 'status', in: 'query', description: 'Statut de facture (unpaid/partial/paid) ou statut de vie (pending/active/suspended/expired/cancelled/renewed/draft)', schema: new OA\Schema(type: 'string')),
            new OA\Parameter(name: 'notification_status', in: 'query', schema: new OA\Schema(type: 'string', enum: ['pending', 'sent', 'failed'])),
            new OA\Parameter(name: 'from', in: 'query', description: 'Début de période (start_date >=)', schema: new OA\Schema(type: 'string', format: 'date')),
            new OA\Parameter(name: 'to', in: 'query', description: 'Fin de période (start_date <=)', schema: new OA\Schema(type: 'string', format: 'date')),
            new OA\Parameter(name: 'end_date_from', in: 'query', schema: new OA\Schema(type: 'string', format: 'date')),
            new OA\Parameter(name: 'end_date_to', in: 'query', schema: new OA\Schema(type: 'string', format: 'date')),
            new OA\Parameter(name: 'expiring_soon', in: 'query', description: 'Expire dans les 30 jours', schema: new OA\Schema(type: 'boolean')),
            new OA\Parameter(name: 'is_expired', in: 'query', schema: new OA\Schema(type: 'boolean')),
            new OA\Parameter(name: 'per_page', in: 'query', schema: new OA\Schema(type: 'integer', default: 15)),
        ],
        responses: [
            new OA\Response(response: 200, description: 'Liste paginée des abonnements'),
        ]
    )]
    public function index(Request $request): JsonResponse
    {
        $subscriptions = Subscription::query()
            ->with('pack', 'agency:id,name', 'client:id,first_name,last_name,email', 'invoice', 'notifications')
            ->when($request->agency_id, fn ($q, $id) => $q->where('agency_id', $id))
            ->when($request->client_id, fn ($q, $id) => $q->where('client_id', $id))
            ->when($request->pack_id, fn ($q, $id) => $q->where('subscription_pack_id', $id))
            ->when($request->country_id, fn ($q, $id) => $q->whereHas('client', fn ($c) => $c->where('country_id', $id)))
            ->when($request->city_id, fn ($q, $id) => $q->whereHas('client', fn ($c) => $c->where('city_id', $id)))
            ->when($request->commercial_id, fn ($q, $id) => $q->whereHas('client', fn ($c) => $c->where('commercial_user_id', $id)))
            ->when($request->from, fn ($q, $v) => $q->whereDate('start_date', '>=', $v))
            ->when($request->to, fn ($q, $v) => $q->whereDate('start_date', '<=', $v))
            ->when($request->end_date_from, fn ($q, $v) => $q->whereDate('end_date', '>=', $v))
            ->when($request->end_date_to, fn ($q, $v) => $q->whereDate('end_date', '<=', $v))
            ->when($request->boolean('expiring_soon'), fn ($q) => $q->whereDate('end_date', '>=', today())
                ->whereDate('end_date', '<=', today()->addDays((int) config('subscriptions.notifications.expiring_soon_days'))))
            ->when($request->boolean('is_expired'), fn ($q) => $q->whereDate('end_date', '<', today()))
            ->when($request->notification_status, fn ($q, $v) => $q->whereHas('notifications', fn ($n) => $n->where('status', $v)))
            ->when($request->status, function ($q, $status) {
                if (in_array($status, Subscription::LIFECYCLE_STATUSES, true)) {
                    if ($status === 'expired') {
                        $q->where(function ($inner) {
                            $inner->where('subscriptions.status', 'expired')
                                ->orWhere(fn ($s) => $s->whereIn('subscriptions.status', ['active', 'pending', 'suspended'])
                                    ->whereDate('end_date', '<', today()));
                        });
                    } else {
                        $q->where('subscriptions.status', $status);
                    }
                } elseif ($status === 'cancelled') {
                    $q->whereHas('invoice', fn ($i) => $i->whereNotNull('cancelled_at'));
                } else {
                    $q->whereHas('invoice', fn ($i) => $i->whereNull('cancelled_at')->where('status', $status));
                }
            })
            ->orderByDesc('start_date')
            ->paginate(min((int) $request->input('per_page', 15), 100));

        $subscriptions->getCollection()->each->refreshStatusIfExpired();

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
            'price_per_month' => ['nullable', 'numeric', 'min:0.01'],
            'status' => ['nullable', 'in:draft,pending,active,suspended'],
            'advance' => ['nullable', 'numeric', 'min:0.01'],
            'payment_type' => ['nullable', 'in:cash,om,momo,mobile'],
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
        $pricePerMonth = (float) ($data['price_per_month'] ?? $pack->price_per_month);
        $total = round($pricePerMonth * (int) $data['months'], 2);
        $status = $data['status'] ?? ($start->isAfter(today()) ? 'pending' : 'active');

        if (! empty($data['advance']) && (float) $data['advance'] > $total) {
            throw ValidationException::withMessages([
                'advance' => "L'avance ne peut pas dépasser le total de l'abonnement ({$total} FCFA).",
            ]);
        }

        $subscription = DB::transaction(function () use ($pack, $data, $client, $start, $pricePerMonth, $total, $status, $request) {
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
                'status' => $status,
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
            'payment_type' => ['nullable', 'in:cash,om,momo,mobile'],
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
            $subscription->update(['status' => 'renewed']);

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
                'status' => 'active',
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
        $subscription->refreshStatusIfExpired();
        $subscription->load(['pack.packServices.service', 'agency', 'client', 'invoice.items', 'invoice.payments', 'notifications']);

        return response()->json($subscription);
    }

    #[OA\Post(
        path: '/api/subscriptions/{subscription}/cancel',
        summary: 'Annuler un abonnement (statut cancelled + date)',
        tags: ['Abonnements'],
        security: [['sanctum' => []]],
        parameters: [
            new OA\Parameter(name: 'subscription', in: 'path', required: true, schema: new OA\Schema(type: 'string', format: 'uuid')),
        ],
        responses: [
            new OA\Response(response: 200, description: 'Abonnement annulé'),
            new OA\Response(response: 422, description: 'Abonnement non annulable'),
        ]
    )]
    public function cancel(Request $request, Subscription $subscription): JsonResponse
    {
        if (! in_array($subscription->status, ['draft', 'pending', 'active', 'suspended'], true)) {
            return response()->json([
                'message' => "Impossible d'annuler un abonnement {$subscription->status}.",
            ], 422);
        }

        $name = $subscription->pack?->name ?? 'Abonnement';

        $subscription->update([
            'status' => 'cancelled',
            'cancelled_at' => today(),
        ]);

        $this->logger->log(
            action: 'cancelled',
            entityType: 'subscription',
            entityId: $subscription->id,
            description: "Abonnement {$name} annulé",
            request: $request,
        );

        return response()->json($subscription->fresh()->load(['pack', 'agency', 'client', 'invoice', 'notifications']));
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

        $serviceCount = $pack->packServices->count();
        $unitPrice = $serviceCount > 0 ? round($pricePerMonth / $serviceCount, 2) : $pricePerMonth;

        foreach ($pack->packServices as $line) {
            $invoice->items()->create([
                'service_id' => $line->service_id,
                'label' => $line->service?->name ?? 'Service',
                'unit_price' => $unitPrice,
                'quantity' => $months,
                'line_total' => round($unitPrice * $months, 2),
            ]);
        }

        return $invoice;
    }
}
