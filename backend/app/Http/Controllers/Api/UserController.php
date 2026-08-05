<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Http\Requests\Api\StoreUserRequest;
use App\Http\Requests\Api\UpdateUserRequest;
use App\Http\Resources\UserResource;
use App\Models\Department;
use App\Models\User;
use App\Services\ActivityLogger;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;
use OpenApi\Attributes as OA;

class UserController extends Controller
{
    private const ALLOWED_WITH = ['role', 'assignments'];

    public function __construct(
        private readonly ActivityLogger $logger,
    ) {}

    private function parseWith(Request $request): array
    {
        $with = $request->input('with');
        if (! $with) {
            return [];
        }
        $relations = array_map('trim', explode(',', $with));

        return array_intersect($relations, self::ALLOWED_WITH);
    }

    #[OA\Get(
        path: '/api/users',
        summary: 'Lister les utilisateurs (admin)',
        tags: ['Utilisateurs'],
        security: [['sanctum' => []]],
        parameters: [
            new OA\Parameter(name: 'search', in: 'query', description: 'Recherche par nom/email/username', schema: new OA\Schema(type: 'string')),
            new OA\Parameter(name: 'is_active', in: 'query', schema: new OA\Schema(type: 'boolean')),
            new OA\Parameter(name: 'per_page', in: 'query', schema: new OA\Schema(type: 'integer', default: 15)),
            new OA\Parameter(name: 'sort', in: 'query', schema: new OA\Schema(type: 'string', default: 'created_at')),
            new OA\Parameter(name: 'order', in: 'query', schema: new OA\Schema(type: 'string', default: 'desc')),
        ],
        responses: [
            new OA\Response(response: 200, description: 'Liste paginée des utilisateurs'),
        ]
    )]
    public function index(Request $request)
    {
        $defaultWith = ['role', 'assignments'];
        $with = array_unique(array_merge($defaultWith, $this->parseWith($request)));

        $user = $request->user();
        $users = User::with($with)
            ->whereHas('role', fn ($q) => $q->where('name', '!=', 'client'))
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
            ->when($request->agency_id, function ($q, $agencyId) {
                $q->whereHas('assignments', fn ($q) => $q->where('agency_id', $agencyId));
            })
            ->when($request->department_id, function ($q, $departmentId) {
                $q->whereHas('assignments', fn ($q) => $q->where('department_id', $departmentId));
            })
            ->when($user?->role?->name === 'responsable-agence', function ($q) use ($user) {
                $agencyIds = DB::table('user_assignments')
                    ->where('user_id', $user->id)
                    ->where('is_primary', true)
                    ->pluck('agency_id');
                $q->whereHas('assignments', fn ($q) => $q->whereIn('agency_id', $agencyIds));
            })
            ->when($user?->role?->name === 'responsable-departement', function ($q) use ($user) {
                $deptIds = DB::table('department_chiefs')
                    ->where('user_id', $user->id)
                    ->pluck('department_id');
                $q->whereHas('assignments', fn ($q) => $q->whereIn('department_id', $deptIds));
            })
            ->orderBy($request->sort ?? 'created_at', $request->order ?? 'desc')
            ->paginate($request->per_page ?? 15);

        return UserResource::collection($users);
    }

    public function store(StoreUserRequest $request): JsonResponse
    {
        $data = $request->validated();
        $data['password'] = Hash::make($data['password'] ?? 'password');

        $creator = $request->user();

        $user = DB::transaction(function () use ($data, $creator) {
            $user = User::create($data);

            // Un responsable d'agence ne peut créer que des employés de ses agences :
            // on rattache automatiquement le nouvel employé à son agence primaire.
            if ($creator?->role?->name === 'responsable-agence') {
                $agencyId = DB::table('user_assignments')
                    ->where('user_id', $creator->id)
                    ->where('is_primary', true)
                    ->value('agency_id');

                if ($agencyId) {
                    $user->assignments()->attach($agencyId, [
                        'is_primary' => false,
                        'is_department_chief' => false,
                        'department_id' => null,
                    ]);
                }

                return $user;
            }

            // Super-admin / direction-générale : rattachement optionnel à une
            // agence et/ou un département fournis lors de la création.
            $agencyId = $data['agency_id'] ?? null;
            $departmentId = $data['department_id'] ?? null;

            // Si seul le département est renseigné, on en déduit l'agence.
            if ($departmentId && ! $agencyId) {
                $agencyId = Department::where('id', $departmentId)->value('agency_id');
            }

            if ($agencyId) {
                $user->assignments()->attach($agencyId, [
                    'is_primary' => false,
                    'is_department_chief' => false,
                    'department_id' => $departmentId,
                ]);
            }

            return $user;
        });

        return (new UserResource($user->fresh()->load('role', 'assignments')))
            ->response()
            ->setStatusCode(201);
    }

    #[OA\Get(
        path: '/api/users/{user}',
        summary: 'Afficher un utilisateur',
        tags: ['Utilisateurs'],
        security: [['sanctum' => []]],
        parameters: [
            new OA\Parameter(name: 'user', in: 'path', required: true, schema: new OA\Schema(type: 'string', format: 'uuid')),
        ],
        responses: [
            new OA\Response(response: 200, description: 'Détail de l\'utilisateur', content: new OA\JsonContent(ref: '#/components/schemas/User')),
            new OA\Response(response: 404, description: 'Utilisateur non trouvé'),
        ]
    )]
    public function show(Request $request, User $user)
    {
        $with = array_unique(array_merge(['role', 'assignments.agency'], $this->parseWith($request)));

        return new UserResource($user->load($with));
    }

    #[OA\Put(
        path: '/api/users/{user}',
        summary: 'Modifier un utilisateur',
        tags: ['Utilisateurs'],
        security: [['sanctum' => []]],
        parameters: [
            new OA\Parameter(name: 'user', in: 'path', required: true, schema: new OA\Schema(type: 'string', format: 'uuid')),
        ],
        requestBody: new OA\RequestBody(
            content: new OA\JsonContent(
                properties: [
                    new OA\Property(property: 'username', type: 'string'),
                    new OA\Property(property: 'email', type: 'string', format: 'email'),
                    new OA\Property(property: 'first_name', type: 'string'),
                    new OA\Property(property: 'last_name', type: 'string'),
                    new OA\Property(property: 'phone', type: 'string'),
                    new OA\Property(property: 'is_active', type: 'boolean'),
                    new OA\Property(property: 'role_id', type: 'string', format: 'uuid'),
                    new OA\Property(property: 'password', type: 'string', format: 'password'),
                    new OA\Property(property: 'password_confirmation', type: 'string'),
                ]
            )
        ),
        responses: [
            new OA\Response(response: 200, description: 'Utilisateur modifié', content: new OA\JsonContent(ref: '#/components/schemas/User')),
            new OA\Response(response: 422, description: 'Erreur de validation'),
        ]
    )]
    public function update(UpdateUserRequest $request, User $user)
    {
        $validated = $request->validated();

        $oldRoleId = $user->role_id;

        if (isset($validated['password'])) {
            $validated['password'] = Hash::make($validated['password']);
        }

        $user->update($validated);

        if (isset($validated['role_id']) && (string) $validated['role_id'] !== (string) $oldRoleId) {
            $this->logger->log(
                action: 'role_changed',
                entityType: 'user',
                entityId: $user->id,
                description: "Rôle de {$user->first_name} {$user->last_name} modifié",
                oldValues: ['role_id' => $oldRoleId],
                newValues: ['role_id' => $validated['role_id']],
                request: $request,
            );
        }

        return new UserResource($user->fresh()->load('role', 'assignments'));
    }

    #[OA\Delete(
        path: '/api/users/{user}',
        summary: 'Supprimer un utilisateur',
        tags: ['Utilisateurs'],
        security: [['sanctum' => []]],
        parameters: [
            new OA\Parameter(name: 'user', in: 'path', required: true, schema: new OA\Schema(type: 'string', format: 'uuid')),
        ],
        responses: [
            new OA\Response(response: 204, description: 'Utilisateur supprimé'),
            new OA\Response(response: 403, description: 'Impossible de supprimer un super administrateur'),
        ]
    )]
    public function destroy(Request $request, User $user): JsonResponse
    {
        if ($user->id === $request->user()->id) {
            return response()->json([
                'message' => 'Vous ne pouvez pas supprimer votre propre compte.',
            ], 422);
        }

        if ($user->role?->name === 'super-admin') {
            $superAdminCount = User::where('role_id', $user->role_id)->count();
            if ($superAdminCount <= 1) {
                return response()->json([
                    'message' => 'Impossible de supprimer le dernier super-administrateur.',
                ], 422);
            }
        }

        $user->tokens()->delete();
        $user->delete();

        $this->logger->log(
            action: 'deleted',
            entityType: 'user',
            entityId: $user->id,
            description: "Utilisateur {$user->first_name} {$user->last_name} supprimé",
            request: $request,
        );

        return response()->json(null, 204);
    }
}
