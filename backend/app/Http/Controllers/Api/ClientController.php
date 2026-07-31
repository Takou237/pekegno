<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Http\Requests\Api\UpdateClientRequest;
use App\Http\Resources\UserResource;
use App\Models\User;
use Illuminate\Http\Request;
use OpenApi\Attributes as OA;

class ClientController extends Controller
{
    private function assertCanViewClients(): void
    {
        $roleName = auth()->user()?->role?->name;
        abort_unless($roleName !== null && $roleName !== 'client', 403, 'Accès réservé au personnel PEKEGNO.');
    }

    private function findClient(User $user): User
    {
        abort_unless($user->role?->name === 'client', 404, 'Client introuvable.');

        return $user;
    }

    #[OA\Get(
        path: '/api/clients',
        summary: 'Lister les clients (personnel uniquement)',
        tags: ['Clients'],
        security: [['sanctum' => []]],
        parameters: [
            new OA\Parameter(name: 'search', in: 'query', description: 'Recherche par nom/email/username', schema: new OA\Schema(type: 'string')),
            new OA\Parameter(name: 'is_active', in: 'query', schema: new OA\Schema(type: 'boolean')),
            new OA\Parameter(name: 'per_page', in: 'query', schema: new OA\Schema(type: 'integer', default: 15)),
            new OA\Parameter(name: 'sort', in: 'query', schema: new OA\Schema(type: 'string', default: 'created_at')),
            new OA\Parameter(name: 'order', in: 'query', schema: new OA\Schema(type: 'string', default: 'desc')),
        ],
        responses: [
            new OA\Response(response: 200, description: 'Liste paginée des clients'),
            new OA\Response(response: 403, description: 'Accès réservé au personnel'),
        ]
    )]
    public function index(Request $request)
    {
        $this->assertCanViewClients();

        $clients = User::with('role')
            ->whereHas('role', fn ($q) => $q->where('name', 'client'))
            ->when($request->search, function ($q, $search) {
                $q->where(function ($q) use ($search) {
                    $q->where('first_name', 'like', "%{$search}%")
                        ->orWhere('last_name', 'like', "%{$search}%")
                        ->orWhere('email', 'like', "%{$search}%")
                        ->orWhere('username', 'like', "%{$search}%");
                });
            })
            ->when($request->is_active !== null, function ($q) use ($request) {
                $q->where('is_active', $request->boolean('is_active'));
            })
            ->orderBy($request->sort ?? 'created_at', $request->order ?? 'desc')
            ->paginate($request->per_page ?? 15);

        return UserResource::collection($clients);
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
            new OA\Response(response: 404, description: 'Client introuvable'),
        ]
    )]
    public function show(Request $request, User $client)
    {
        $this->assertCanViewClients();

        return new UserResource($this->findClient($client)->load('role'));
    }

    #[OA\Put(
        path: '/api/clients/{client}',
        summary: 'Activer/désactiver un client',
        tags: ['Clients'],
        security: [['sanctum' => []]],
        parameters: [
            new OA\Parameter(name: 'client', in: 'path', required: true, schema: new OA\Schema(type: 'string', format: 'uuid')),
        ],
        requestBody: new OA\RequestBody(
            required: true,
            content: new OA\JsonContent(
                properties: [
                    new OA\Property(property: 'is_active', type: 'boolean'),
                ]
            )
        ),
        responses: [
            new OA\Response(response: 200, description: 'Client modifié'),
            new OA\Response(response: 422, description: 'Erreur de validation'),
        ]
    )]
    public function update(UpdateClientRequest $request, User $client)
    {
        $this->findClient($client)->update($request->validated());

        return new UserResource($client->fresh()->load('role'));
    }
}
