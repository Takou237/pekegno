<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Http\Requests\Api\StoreClientRequest;
use App\Http\Requests\Api\UpdateClientRequest;
use App\Http\Resources\UserResource;
use App\Models\Role;
use App\Models\User;
use App\Services\ActivityLogger;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;
use OpenApi\Attributes as OA;

class ClientController extends Controller
{
    public function __construct(
        private readonly ActivityLogger $activityLogger,
    ) {}

    private function clientQuery()
    {
        return User::query()
            ->with('role')
            ->whereHas('role', fn ($q) => $q->where('name', 'client'));
    }

    #[OA\Get(
        path: '/api/clients',
        summary: 'Lister les clients',
        tags: ['Clients'],
        security: [['sanctum' => []]],
        parameters: [
            new OA\Parameter(name: 'search', in: 'query', description: 'Recherche par nom/email/téléphone/client_number', schema: new OA\Schema(type: 'string')),
            new OA\Parameter(name: 'agency_id', in: 'query', schema: new OA\Schema(type: 'string', format: 'uuid')),
            new OA\Parameter(name: 'per_page', in: 'query', schema: new OA\Schema(type: 'integer', default: 15)),
        ],
        responses: [
            new OA\Response(response: 200, description: 'Liste paginée des clients'),
        ]
    )]
    public function index(Request $request)
    {
        $clients = $this->clientQuery()
            ->when($request->search, function ($q, $search) {
                $q->where(function ($q) use ($search) {
                    $q->where('first_name', 'like', "%{$search}%")
                        ->orWhere('last_name', 'like', "%{$search}%")
                        ->orWhere('email', 'like', "%{$search}%")
                        ->orWhere('phone', 'like', "%{$search}%")
                        ->orWhere('client_number', 'like', "%{$search}%");
                });
            })
            ->when($request->agency_id, fn ($q, $agencyId) => $q->whereHas('clientInvoices', fn ($q) => $q->where('agency_id', $agencyId)))
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

        return (new UserResource($user->fresh()->load('role')))
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
    public function show(User $client): JsonResponse
    {
        if ($client->role?->name !== 'client') {
            return response()->json(['message' => 'Client non trouvé.'], 404);
        }

        return new UserResource($client->load('role', 'clientInvoices'));
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
        $oldValues = $client->only(['first_name', 'last_name', 'email', 'phone', 'city', 'country', 'address', 'is_active']);

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
            newValues: $client->only(['first_name', 'last_name', 'email', 'phone', 'city', 'country', 'address', 'is_active']),
            request: $request,
        );

        return new UserResource($client->fresh()->load('role'));
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

        $clients = $this->clientQuery()
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