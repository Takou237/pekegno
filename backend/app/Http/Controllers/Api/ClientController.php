<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Http\Requests\Api\StoreClientRequest;
use App\Http\Requests\Api\UpdateClientRequest;
use App\Http\Resources\UserResource;
use App\Models\Invoice;
use App\Models\InvoicePayment;
use App\Models\Role;
use App\Models\Subscription;
use App\Models\User;
use App\Services\ActivityLogger;
use App\Services\ScopeService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;
use OpenApi\Attributes as OA;

class ClientController extends Controller
{
    public function __construct(
        private readonly ActivityLogger $activityLogger,
        private readonly ScopeService $scopeService,
    ) {}

    /**
     * Requête de base des clients avec les charges utiles Phase 4
     * (catégorie, localisation, origine) et le périmètre organisationnel.
     */
    private function clientQuery(?Request $request = null)
    {
        $query = User::query()
            ->with([
                'role',
                'clientCategory',
                'geoCountry',
                'geoCity',
                'registeredAgency',
                'referringCommercial',
            ])
            ->whereHas('role', fn ($q) => $q->where('name', 'client'));

        if ($request) {
            $agencyIds = $this->scopeService->agencyIds($request->user());

            if ($agencyIds !== null) {
                $query->where(function ($q) use ($agencyIds) {
                    $q->whereIn('registered_agency_id', $agencyIds)
                        ->orWhereHas('clientInvoices', fn ($q) => $q->whereIn('agency_id', $agencyIds));
                });
            }
        }

        return $query;
    }

    #[OA\Get(
        path: '/api/clients',
        summary: 'Lister les clients',
        tags: ['Clients'],
        security: [['sanctum' => []]],
        parameters: [
            new OA\Parameter(name: 'search', in: 'query', description: 'Recherche par nom/email/téléphone/client_number', schema: new OA\Schema(type: 'string')),
            new OA\Parameter(name: 'agency_id', in: 'query', schema: new OA\Schema(type: 'string', format: 'uuid')),
            new OA\Parameter(name: 'status', in: 'query', schema: new OA\Schema(type: 'string', enum: ['lead', 'learning', 'active', 'inactive', 'former'])),
            new OA\Parameter(name: 'client_category_id', in: 'query', schema: new OA\Schema(type: 'string', format: 'uuid')),
            new OA\Parameter(name: 'country_id', in: 'query', schema: new OA\Schema(type: 'string', format: 'uuid')),
            new OA\Parameter(name: 'city_id', in: 'query', schema: new OA\Schema(type: 'string', format: 'uuid')),
            new OA\Parameter(name: 'registered_agency_id', in: 'query', schema: new OA\Schema(type: 'string', format: 'uuid')),
            new OA\Parameter(name: 'commercial_user_id', in: 'query', schema: new OA\Schema(type: 'string', format: 'uuid')),
            new OA\Parameter(name: 'from', in: 'query', description: 'Enregistré à partir de (Y-m-d)', schema: new OA\Schema(type: 'string', format: 'date')),
            new OA\Parameter(name: 'to', in: 'query', description: 'Enregistré jusqu\'à (Y-m-d)', schema: new OA\Schema(type: 'string', format: 'date')),
            new OA\Parameter(name: 'per_page', in: 'query', schema: new OA\Schema(type: 'integer', default: 15)),
        ],
        responses: [
            new OA\Response(response: 200, description: 'Liste paginée des clients'),
        ]
    )]
    public function index(Request $request)
    {
        $clients = $this->clientQuery($request)
            ->when($request->search, function ($q, $search) {
                $q->where(function ($q) use ($search) {
                    $q->where('first_name', 'like', "%{$search}%")
                        ->orWhere('last_name', 'like', "%{$search}%")
                        ->orWhere('email', 'like', "%{$search}%")
                        ->orWhere('phone', 'like', "%{$search}%")
                        ->orWhere('client_number', 'like', "%{$search}%");
                });
            })
            ->when($request->status, fn ($q, $status) => $q->where('status', $status))
            ->when($request->client_category_id, fn ($q, $id) => $q->where('client_category_id', $id))
            ->when($request->country_id, fn ($q, $id) => $q->where('country_id', $id))
            ->when($request->city_id, fn ($q, $id) => $q->where('city_id', $id))
            ->when($request->registered_agency_id, fn ($q, $id) => $q->where('registered_agency_id', $id))
            ->when($request->commercial_user_id, fn ($q, $id) => $q->where('commercial_user_id', $id))
            ->when($request->agency_id, fn ($q, $agencyId) => $q->whereHas('clientInvoices', fn ($q) => $q->where('agency_id', $agencyId)))
            ->when($request->from, fn ($q, $d) => $q->whereDate('registered_at', '>=', $d))
            ->when($request->to, fn ($q, $d) => $q->whereDate('registered_at', '<=', $d))
            ->orderBy('created_at', 'desc')
            ->paginate(min((int) $request->input('per_page', 15), 100));

        return UserResource::collection($clients);
    }

    #[OA\Post(
        path: '/api/clients',
        summary: 'Créer un client (admin)',
        tags: ['Clients'],
        security: [['sanctum' => []]],
        responses: [
            new OA\Response(response: 201, description: 'Client créé'),
            new OA\Response(response: 422, description: 'Erreur de validation'),
        ]
    )]
    public function store(StoreClientRequest $request): JsonResponse
    {
        $clientRole = Role::where('name', 'client')->firstOrFail();
        $data = $request->validated();

        $hasPassword = ! empty($data['password']);

        $user = DB::transaction(function () use ($data, $hasPassword, $clientRole, $request) {
            $user = User::create([
                'username' => $data['email'],
                'email' => $data['email'],
                'password' => $hasPassword ? $data['password'] : Str::password(16),
                'first_name' => $data['first_name'] ?? null,
                'last_name' => $data['last_name'] ?? null,
                'phone' => $data['phone'] ?? null,
                'city' => $data['city'] ?? null,
                'country' => $data['country'] ?? null,
                'address' => $data['address'] ?? null,
                'role_id' => $clientRole->id,
                'is_active' => $data['is_active'] ?? true,
                'is_password_change_required' => ! $hasPassword,
                'client_category_id' => $data['client_category_id'] ?? null,
                'status' => $data['status'] ?? 'lead',
                'country_id' => $data['country_id'] ?? null,
                'city_id' => $data['city_id'] ?? null,
                'registered_agency_id' => $data['registered_agency_id'] ?? null,
                'commercial_user_id' => $data['commercial_user_id'] ?? null,
                'registered_at' => $data['registered_at'] ?? now(),
            ]);

            $user->update(['client_number' => User::generateClientNumber()]);

            $this->activityLogger->log(
                action: 'created',
                entityType: 'client',
                entityId: $user->id,
                description: "Client {$user->client_number} créé",
                newValues: ['email' => $user->email],
                request: $request,
            );

            return $user;
        });

        return (new UserResource($user->fresh()->load(['role', 'clientCategory', 'geoCountry', 'geoCity', 'registeredAgency', 'referringCommercial'])))
            ->response()
            ->setStatusCode(201);
    }

    #[OA\Get(
        path: '/api/clients/{client}',
        summary: 'Afficher un client',
        tags: ['Clients'],
        security: [['sanctum' => []]],
        parameters: [
            new OA\Parameter(name: 'client', in: 'path', required: true, schema: new OA\Schema(type: 'string', format: 'uuid')),
        ],
        responses: [
            new OA\Response(response: 200, description: 'Détail du client'),
            new OA\Response(response: 404, description: 'Client non trouvé'),
        ]
    )]
    public function show(Request $request, User $client): JsonResponse
    {
        if ($client->role?->name !== 'client') {
            return response()->json(['message' => 'Client non trouvé.'], 404);
        }

        return (new UserResource($client->load([
            'role',
            'clientCategory',
            'geoCountry',
            'geoCity',
            'registeredAgency',
            'referringCommercial',
        ])))->response();
    }

    #[OA\Get(
        path: '/api/clients/{client}/history',
        summary: 'Historique client (factures, paiements, abonnements)',
        tags: ['Clients'],
        security: [['sanctum' => []]],
        parameters: [
            new OA\Parameter(name: 'client', in: 'path', required: true, schema: new OA\Schema(type: 'string', format: 'uuid')),
        ],
        responses: [
            new OA\Response(response: 200, description: 'Historique complet du client'),
            new OA\Response(response: 404, description: 'Client non trouvé'),
        ]
    )]
    public function history(Request $request, User $client): JsonResponse
    {
        if ($client->role?->name !== 'client') {
            return response()->json(['message' => 'Client non trouvé.'], 404);
        }

        $invoices = Invoice::query()
            ->with('agency:id,name,code')
            ->where('client_id', $client->id)
            ->whereNull('cancelled_at')
            ->orderByDesc('invoice_date')
            ->limit(100)
            ->get(['id', 'number', 'agency_id', 'invoice_date', 'total_amount', 'amount_paid', 'status']);

        $payments = InvoicePayment::query()
            ->with('invoice:id,number,invoice_date')
            ->whereHas('invoice', fn ($q) => $q->where('client_id', $client->id))
            ->orderByDesc('paid_at')
            ->limit(100)
            ->get(['id', 'invoice_id', 'amount', 'payment_method', 'is_advance', 'paid_at']);

        $subscriptions = $client->clientSubscriptions()
            ->with('pack:id,name', 'agency:id,name', 'invoice:id,number')
            ->orderByDesc('start_date')
            ->get();

        return response()->json([
            'summary' => [
                'invoices_count' => $invoices->count(),
                'total_billed' => round((float) $invoices->sum('total_amount'), 2),
                'total_paid' => round((float) $invoices->sum('amount_paid'), 2),
                'balance_due' => round((float) $invoices->sum(fn ($i) => max(0, (float) $i->total_amount - (float) $i->amount_paid)), 2),
                'subscriptions_count' => $subscriptions->count(),
            ],
            'invoices' => $invoices->map(fn (Invoice $i) => [
                'id' => $i->id,
                'number' => $i->number,
                'agency' => $i->agency?->name,
                'date' => $i->invoice_date?->toISOString(),
                'total' => (float) $i->total_amount,
                'paid' => (float) $i->amount_paid,
                'balance' => $i->balance_due,
                'status' => $i->status,
            ]),
            'payments' => $payments->map(fn (InvoicePayment $p) => [
                'id' => $p->id,
                'invoice_number' => $p->invoice?->number,
                'invoice_date' => $p->invoice?->invoice_date?->toISOString(),
                'amount' => (float) $p->amount,
                'method' => $p->payment_method,
                'is_advance' => $p->is_advance,
                'paid_at' => $p->paid_at?->toISOString(),
            ]),
            'subscriptions' => $subscriptions->map(fn (Subscription $s) => [
                'id' => $s->id,
                'pack' => $s->pack?->name,
                'agency' => $s->agency?->name,
                'months' => $s->months,
                'total_price' => (float) $s->total_price,
                'start_date' => $s->start_date?->toISOString(),
                'end_date' => $s->end_date?->toISOString(),
                'invoice_number' => $s->invoice?->number,
            ]),
        ]);
    }

    #[OA\Put(
        path: '/api/clients/{client}',
        summary: 'Modifier un client',
        tags: ['Clients'],
        security: [['sanctum' => []]],
        parameters: [
            new OA\Parameter(name: 'client', in: 'path', required: true, schema: new OA\Schema(type: 'string', format: 'uuid')),
        ],
        responses: [
            new OA\Response(response: 200, description: 'Client modifié'),
            new OA\Response(response: 422, description: 'Erreur de validation'),
        ]
    )]
    public function update(UpdateClientRequest $request, User $client): JsonResponse
    {
        if ($client->role?->name !== 'client') {
            return response()->json(['message' => 'Client non trouvé.'], 404);
        }

        $data = $request->validated();
        $tracked = [
            'first_name', 'last_name', 'email', 'phone', 'city', 'country', 'address',
            'is_active', 'client_category_id', 'status', 'country_id', 'city_id',
            'registered_agency_id', 'commercial_user_id', 'registered_at',
        ];
        $oldValues = $client->only($tracked);

        if (isset($data['password'])) {
            $data['password'] = $data['password'];
            $data['is_password_change_required'] = false;
        }

        $client->update($data);

        $this->activityLogger->log(
            action: 'updated',
            entityType: 'client',
            entityId: $client->id,
            description: "Client {$client->client_number} modifié",
            oldValues: $oldValues,
            newValues: $client->only($tracked),
            request: $request,
        );

        return (new UserResource($client->fresh()->load([
            'role',
            'clientCategory',
            'geoCountry',
            'geoCity',
            'registeredAgency',
            'referringCommercial',
        ])))->response();
    }

    #[OA\Delete(
        path: '/api/clients/{client}',
        summary: 'Supprimer un client',
        tags: ['Clients'],
        security: [['sanctum' => []]],
        parameters: [
            new OA\Parameter(name: 'client', in: 'path', required: true, schema: new OA\Schema(type: 'string', format: 'uuid')),
        ],
        responses: [
            new OA\Response(response: 204, description: 'Client supprimé'),
            new OA\Response(response: 422, description: 'Client avec factures ou non trouvé'),
        ]
    )]
    public function destroy(Request $request, User $client): JsonResponse
    {
        if ($client->role?->name !== 'client') {
            return response()->json(['message' => 'Client non trouvé.'], 404);
        }

        if ($client->clientInvoices()->exists()) {
            return response()->json([
                'message' => 'Ce client possède des factures et ne peut pas être supprimé.',
            ], 422);
        }

        $clientNumber = $client->client_number;

        $client->tokens()->delete();
        $client->delete();

        $this->activityLogger->log(
            action: 'deleted',
            entityType: 'client',
            entityId: $client->id,
            description: "Client {$clientNumber} supprimé",
            request: $request,
        );

        return response()->json(null, 204);
    }

    #[OA\Get(
        path: '/api/clients/search',
        summary: 'Autocomplétion de clients (nom/email/téléphone/client_number)',
        tags: ['Clients'],
        security: [['sanctum' => []]],
        parameters: [
            new OA\Parameter(name: 'q', in: 'query', required: true, schema: new OA\Schema(type: 'string')),
        ],
        responses: [
            new OA\Response(response: 200, description: 'Résultats de recherche'),
        ]
    )]
    public function search(Request $request): JsonResponse
    {
        $q = trim((string) $request->query('q'));

        $clients = $this->clientQuery($request)
            ->when($q, function ($query) use ($q) {
                $query->where(function ($query) use ($q) {
                    $query->where('first_name', 'like', "%{$q}%")
                        ->orWhere('last_name', 'like', "%{$q}%")
                        ->orWhere('email', 'like', "%{$q}%")
                        ->orWhere('phone', 'like', "%{$q}%")
                        ->orWhere('client_number', 'like', "%{$q}%");
                });
            })
            ->limit(10)
            ->get(['id', 'first_name', 'last_name', 'email', 'phone', 'client_number']);

        return response()->json($clients);
    }
}