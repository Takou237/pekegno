<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Http\Requests\Api\StoreProspectRequest;
use App\Http\Requests\Api\UpdateProspectRequest;
use App\Http\Resources\UserResource;
use App\Models\Commercial;
use App\Models\Prospect;
use App\Models\Role;
use App\Models\User;
use App\Services\ActivityLogger;
use App\Services\PointsService;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;
use Illuminate\Validation\ValidationException;
use OpenApi\Attributes as OA;

class ProspectController extends Controller
{
    public function __construct(
        private readonly PointsService $pointsService,
        private readonly ActivityLogger $logger,
    ) {}

    private function scopeByRole(Builder $query, ?User $user): Builder
    {
        if (! $user) {
            return $query->whereRaw('1 = 0');
        }

        if (in_array($user->role?->name, ['super-admin', 'direction-generale'], true)) {
            return $query;
        }

        if (in_array($user->role?->name, ['responsable-agence', 'responsable-departement'], true)) {
            $agencyIds = DB::table('user_assignments')
                ->where('user_id', $user->id)
                ->pluck('agency_id');

            return $query->whereIn('agency_id', $agencyIds);
        }

        if ($user->role?->name === 'commercial' && $user->commercialProfile) {
            return $query->where('commercial_id', $user->commercialProfile->id);
        }

        return $query->whereRaw('1 = 0');
    }

    #[OA\Get(
        path: '/api/prospects',
        summary: 'Lister les prospects',
        tags: ['Prospects'],
        security: [['sanctum' => []]],
        parameters: [
            new OA\Parameter(name: 'search', in: 'query', schema: new OA\Schema(type: 'string')),
            new OA\Parameter(name: 'commercial_id', in: 'query', schema: new OA\Schema(type: 'string', format: 'uuid')),
            new OA\Parameter(name: 'agency_id', in: 'query', schema: new OA\Schema(type: 'string', format: 'uuid')),
            new OA\Parameter(name: 'per_page', in: 'query', schema: new OA\Schema(type: 'integer', default: 15)),
        ],
        responses: [
            new OA\Response(response: 200, description: 'Liste paginée des prospects'),
        ]
    )]
    public function index(Request $request): JsonResponse
    {
        $prospects = $this->scopeByRole(Prospect::query(), $request->user())
            ->with(['commercial:id,first_name,last_name,email', 'agency:id,name'])
            ->when($request->commercial_id, fn ($q, $id) => $q->where('commercial_id', $id))
            ->when($request->agency_id, fn ($q, $id) => $q->where('agency_id', $id))
            ->when($request->search, function ($q, $search) {
                $q->where(function ($q) use ($search) {
                    $q->where('first_name', 'like', "%{$search}%")
                        ->orWhere('last_name', 'like', "%{$search}%")
                        ->orWhere('email', 'like', "%{$search}%")
                        ->orWhere('phone', 'like', "%{$search}%");
                });
            })
            ->orderByDesc('created_at')
            ->paginate(min((int) $request->input('per_page', 15), 100));

        return response()->json($prospects);
    }

    #[OA\Post(
        path: '/api/prospects',
        summary: 'Créer un prospect (attribue les points au commercial)',
        tags: ['Prospects'],
        security: [['sanctum' => []]],
        responses: [
            new OA\Response(response: 201, description: 'Prospect créé'),
            new OA\Response(response: 422, description: 'Erreur de validation'),
        ]
    )]
    public function store(StoreProspectRequest $request): JsonResponse
    {
        $data = $request->validated();
        $actor = $request->user();

        $prospect = DB::transaction(function () use ($data, $actor, $request) {
            // Un commercial crée toujours ses propres prospects.
            $commercialId = $data['commercial_id'] ?? null;
            if ($actor->role?->name === 'commercial' && $actor->commercialProfile) {
                $commercialId = $actor->commercialProfile->id;
            }

            if (! $commercialId) {
                throw ValidationException::withMessages([
                    'commercial_id' => 'Le commercial est obligatoire.',
                ]);
            }

            $commercial = Commercial::findOrFail($commercialId);

            $prospect = Prospect::create([
                'commercial_id' => $commercial->id,
                'agency_id' => $data['agency_id'] ?? $commercial->agency_id,
                'first_name' => $data['first_name'],
                'last_name' => $data['last_name'],
                'email' => $data['email'] ?? null,
                'phone' => $data['phone'] ?? null,
                'city' => $data['city'] ?? null,
                'country' => $data['country'] ?? null,
                'address' => $data['address'] ?? null,
                'notes' => $data['notes'] ?? null,
                'created_by' => $actor->id,
            ]);

            $this->pointsService->awardForProspect($prospect, $actor->id);

            $this->logger->log(
                action: 'created',
                entityType: 'prospect',
                entityId: $prospect->id,
                description: "Prospect {$prospect->full_name} créé",
                newValues: ['email' => $prospect->email],
                request: $request,
            );

            return $prospect;
        });

        return response()->json($prospect->fresh()->load('commercial', 'agency'), 201);
    }

    #[OA\Get(
        path: '/api/prospects/{prospect}',
        summary: 'Afficher un prospect',
        tags: ['Prospects'],
        security: [['sanctum' => []]],
        parameters: [
            new OA\Parameter(name: 'prospect', in: 'path', required: true, schema: new OA\Schema(type: 'string', format: 'uuid')),
        ],
        responses: [
            new OA\Response(response: 200, description: 'Détail du prospect'),
        ]
    )]
    public function show(Request $request, Prospect $prospect): JsonResponse
    {
        $this->scopeByRole(Prospect::whereKey($prospect->id), $request->user())->firstOrFail();

        return response()->json($prospect->load('commercial', 'agency'));
    }

    #[OA\Put(
        path: '/api/prospects/{prospect}',
        summary: 'Modifier un prospect',
        tags: ['Prospects'],
        security: [['sanctum' => []]],
        parameters: [
            new OA\Parameter(name: 'prospect', in: 'path', required: true, schema: new OA\Schema(type: 'string', format: 'uuid')),
        ],
        responses: [
            new OA\Response(response: 200, description: 'Prospect modifié'),
        ]
    )]
    public function update(UpdateProspectRequest $request, Prospect $prospect): JsonResponse
    {
        $this->scopeByRole(Prospect::whereKey($prospect->id), $request->user())->firstOrFail();

        $oldValues = $prospect->only(['first_name', 'last_name', 'email', 'phone', 'city', 'country', 'address', 'notes']);

        $prospect->update($request->validated());

        $this->logger->log(
            action: 'updated',
            entityType: 'prospect',
            entityId: $prospect->id,
            description: "Prospect {$prospect->full_name} modifié",
            oldValues: $oldValues,
            newValues: $prospect->only(['first_name', 'last_name', 'email', 'phone', 'city', 'country', 'address', 'notes']),
            request: $request,
        );

        return response()->json($prospect->fresh()->load('commercial', 'agency'));
    }

    #[OA\Delete(
        path: '/api/prospects/{prospect}',
        summary: 'Supprimer un prospect',
        tags: ['Prospects'],
        security: [['sanctum' => []]],
        parameters: [
            new OA\Parameter(name: 'prospect', in: 'path', required: true, schema: new OA\Schema(type: 'string', format: 'uuid')),
        ],
        responses: [
            new OA\Response(response: 204, description: 'Prospect supprimé'),
        ]
    )]
    public function destroy(Request $request, Prospect $prospect): JsonResponse
    {
        $this->scopeByRole(Prospect::whereKey($prospect->id), $request->user())->firstOrFail();

        $name = $prospect->full_name;
        $prospect->delete();

        $this->logger->log(
            action: 'deleted',
            entityType: 'prospect',
            entityId: $prospect->id,
            description: "Prospect {$name} supprimé",
            request: $request,
        );

        return response()->json(null, 204);
    }

    #[OA\Post(
        path: '/api/prospects/{prospect}/convert',
        summary: 'Convertir un prospect en client (supprime le prospect, crée le client, récompense le commercial)',
        tags: ['Prospects'],
        security: [['sanctum' => []]],
        parameters: [
            new OA\Parameter(name: 'prospect', in: 'path', required: true, schema: new OA\Schema(type: 'string', format: 'uuid')),
        ],
        responses: [
            new OA\Response(response: 201, description: 'Client créé'),
            new OA\Response(response: 422, description: 'Email déjà utilisé ou prospect introuvable'),
        ]
    )]
    public function convert(Request $request, Prospect $prospect): JsonResponse
    {
        $this->scopeByRole(Prospect::whereKey($prospect->id), $request->user())->firstOrFail();

        if ($prospect->email && User::where('email', $prospect->email)->exists()) {
            return response()->json(['message' => 'Un client avec cet email existe déjà.'], 422);
        }

        $actorId = $request->user()->id;

        $client = DB::transaction(function () use ($prospect, $actorId, $request) {
            $clientRole = Role::where('name', 'client')->firstOrFail();

            $email = $prospect->email
                ?: Str::lower(Str::slug($prospect->full_name) ?: 'prospect').'-'.Str::random(6).'@pekegno.local';

            $user = User::create([
                'username' => $email,
                'email' => $email,
                'password' => Str::password(16),
                'first_name' => $prospect->first_name,
                'last_name' => $prospect->last_name,
                'phone' => $prospect->phone,
                'city' => $prospect->city,
                'country' => $prospect->country,
                'address' => $prospect->address,
                'role_id' => $clientRole->id,
                'is_active' => true,
                'is_password_change_required' => true,
            ]);

            $user->update(['client_number' => User::generateClientNumber()]);

            $this->pointsService->awardForConversion($prospect->commercial, $actorId);

            $prospect->delete();

            return $user;
        });

        $this->logger->log(
            action: 'converted',
            entityType: 'prospect',
            entityId: $prospect->id,
            description: "Prospect {$prospect->full_name} converti en client {$client->client_number}",
            newValues: ['client_id' => $client->id, 'client_number' => $client->client_number],
            request: $request,
        );

        return (new UserResource($client->fresh()->load('role')))->response()->setStatusCode(201);
    }
}
