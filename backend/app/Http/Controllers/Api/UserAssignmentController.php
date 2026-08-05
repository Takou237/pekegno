<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Http\Resources\AgencyResource;
use App\Http\Resources\DepartmentResource;
use App\Http\Resources\UserResource;
use App\Models\Agency;
use App\Models\Department;
use App\Models\Role;
use App\Models\User;
use App\Services\ActivityLogger;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;
use OpenApi\Attributes as OA;

class UserAssignmentController extends Controller
{
    private const NON_ASSIGNABLE_ROLES = ['super-admin', 'direction-generale', 'client'];

    public function __construct(
        private readonly ActivityLogger $logger,
    ) {}

    private function assertUserIsAssignable(User $user): void
    {
        if (in_array($user->role?->name, self::NON_ASSIGNABLE_ROLES, true)) {
            abort(422, 'Ce profil ne peut pas être assigné à une agence ou un département.');
        }
    }

    private function syncRole(User $user, string $roleName): void
    {
        $role = Role::where('name', $roleName)->first();
        if ($role) {
            $user->update(['role_id' => $role->id]);
        }
    }

    private function clearRoleIfOrphaned(User $user): void
    {
        $stillAgencyChief = DB::table('user_assignments')
            ->where('user_id', $user->id)
            ->where('is_primary', true)
            ->exists();

        $stillDeptChief = DB::table('department_chiefs')
            ->where('user_id', $user->id)
            ->exists();

        if (! $stillAgencyChief && ! $stillDeptChief) {
            $user->update(['role_id' => null]);
        }
    }

    private function syncChiefRole(User $user): void
    {
        if (DB::table('user_assignments')->where('user_id', $user->id)->where('is_primary', true)->exists()) {
            $this->syncRole($user, 'responsable-agence');
        } elseif (DB::table('user_assignments')->where('user_id', $user->id)->where('is_department_chief', true)->exists()) {
            $this->syncRole($user, 'responsable-departement');
        }
    }

    // ─── Agency Chief ────────────────────────────────────────────────────

    #[OA\Put(
        path: '/api/agencies/{agency}/chief',
        summary: 'Assigner un chef d\'agence',
        tags: ['Agences - Affectations'],
        security: [['sanctum' => []]],
        parameters: [
            new OA\Parameter(name: 'agency', in: 'path', required: true, schema: new OA\Schema(type: 'string', format: 'uuid')),
        ],
        requestBody: new OA\RequestBody(
            required: true,
            content: new OA\JsonContent(
                required: ['user_id'],
                properties: [
                    new OA\Property(property: 'user_id', type: 'string', format: 'uuid'),
                ]
            )
        ),
        responses: [
            new OA\Response(response: 200, description: 'Chef d\'agence assigné'),
            new OA\Response(response: 422, description: 'Erreur de validation'),
        ]
    )]
    public function assignChief(Request $request, Agency $agency): JsonResponse
    {
        $this->authorize('update', $agency);

        $request->validate([
            'user_id' => ['required', 'string', 'exists:users,id'],
        ], [
            'user_id.required' => "L'utilisateur est obligatoire.",
            'user_id.exists' => "Cet utilisateur n'existe pas.",
        ]);

        $userId = $request->input('user_id');
        $user = User::findOrFail($userId);
        $this->assertUserIsAssignable($user);

        DB::transaction(function () use ($agency, $userId) {
            $oldChiefAssignment = DB::table('user_assignments')
                ->where('agency_id', $agency->id)
                ->where('is_primary', true)
                ->first();

            DB::table('user_assignments')
                ->where('agency_id', $agency->id)
                ->where('is_primary', true)
                ->update(['is_primary' => false]);

            $existing = DB::table('user_assignments')
                ->where('user_id', $userId)
                ->where('agency_id', $agency->id)
                ->first();

            if ($existing) {
                DB::table('user_assignments')
                    ->where('user_id', $userId)
                    ->where('agency_id', $agency->id)
                    ->update(['is_primary' => true]);
            } else {
                DB::table('user_assignments')->insert([
                    'user_id' => $userId,
                    'agency_id' => $agency->id,
                    'department_id' => null,
                    'is_primary' => true,
                    'is_department_chief' => false,
                    'created_at' => now(),
                    'updated_at' => now(),
                ]);
            }

            if ($oldChiefAssignment && $oldChiefAssignment->user_id !== $userId) {
                $oldChief = User::find($oldChiefAssignment->user_id);
                if ($oldChief) {
                    $this->syncChiefRole($oldChief);
                    if (! DB::table('user_assignments')->where('user_id', $oldChief->id)->where('is_primary', true)->exists()) {
                        $this->clearRoleIfOrphaned($oldChief);
                    }
                }
            }
        });

        $this->syncRole($user, 'responsable-agence');
        $agency->load('assignedUsers');

        $this->logger->log(
            action: 'assigned',
            entityType: 'agency',
            entityId: $agency->id,
            description: "{$user->first_name} {$user->last_name} nommé chef d'agence {$agency->code}",
            newValues: ['user_id' => $userId],
            request: $request,
        );

        return response()->json([
            'message' => 'Chef d\'agence assigné avec succès.',
            'data' => new AgencyResource($agency),
        ]);
    }

    #[OA\Delete(
        path: '/api/agencies/{agency}/chief',
        summary: 'Retirer le chef d\'agence',
        tags: ['Agences - Affectations'],
        security: [['sanctum' => []]],
        parameters: [
            new OA\Parameter(name: 'agency', in: 'path', required: true, schema: new OA\Schema(type: 'string', format: 'uuid')),
        ],
        responses: [
            new OA\Response(response: 200, description: 'Chef retiré'),
        ]
    )]
    public function removeChief(Request $request, Agency $agency): JsonResponse
    {
        $this->authorize('update', $agency);

        $oldChiefAssignment = DB::table('user_assignments')
            ->where('agency_id', $agency->id)
            ->where('is_primary', true)
            ->first();

        DB::table('user_assignments')
            ->where('agency_id', $agency->id)
            ->where('is_primary', true)
            ->update(['is_primary' => false]);

        if ($oldChiefAssignment) {
            $oldChief = User::find($oldChiefAssignment->user_id);
            if ($oldChief) {
                $this->clearRoleIfOrphaned($oldChief);
            }
        }

        $removedChiefId = $oldChiefAssignment?->user_id ?? 'inconnu';

        $this->logger->log(
            action: 'unassigned',
            entityType: 'agency',
            entityId: $agency->id,
            description: "Chef d'agence retiré ({$removedChiefId})",
            request: $request,
        );

        return response()->json(['message' => 'Chef d\'agence retiré avec succès.']);
    }

    // ─── Agency Users ────────────────────────────────────────────────────

    #[OA\Get(
        path: '/api/agencies/{agency}/users',
        summary: 'Lister les utilisateurs assignés à une agence',
        tags: ['Agences - Affectations'],
        security: [['sanctum' => []]],
        parameters: [
            new OA\Parameter(name: 'agency', in: 'path', required: true, schema: new OA\Schema(type: 'string', format: 'uuid')),
        ],
        responses: [
            new OA\Response(response: 200, description: 'Liste des utilisateurs assignés'),
        ]
    )]
    public function listAgencyUsers(Request $request, Agency $agency): JsonResponse
    {
        $this->authorize('view', $agency);

        $users = $agency->assignedUsers()->get();

        return response()->json(UserResource::collection($users));
    }

    #[OA\Post(
        path: '/api/agencies/{agency}/users',
        summary: 'Assigner un utilisateur à une agence',
        tags: ['Agences - Affectations'],
        security: [['sanctum' => []]],
        parameters: [
            new OA\Parameter(name: 'agency', in: 'path', required: true, schema: new OA\Schema(type: 'string', format: 'uuid')),
        ],
        requestBody: new OA\RequestBody(
            required: true,
            content: new OA\JsonContent(
                required: ['user_id'],
                properties: [
                    new OA\Property(property: 'user_id', type: 'string', format: 'uuid'),
                    new OA\Property(property: 'department_id', type: 'string', format: 'uuid'),
                ]
            )
        ),
        responses: [
            new OA\Response(response: 201, description: 'Utilisateur assigné'),
            new OA\Response(response: 422, description: 'Erreur de validation'),
        ]
    )]
    public function assignUser(Request $request, Agency $agency): JsonResponse
    {
        $this->authorize('update', $agency);

        $request->validate([
            'user_id' => ['required', 'string', 'exists:users,id'],
            'department_id' => ['nullable', 'string', 'exists:departments,id'],
        ], [
            'user_id.required' => "L'utilisateur est obligatoire.",
            'user_id.exists' => "Cet utilisateur n'existe pas.",
            'department_id.exists' => "Ce département n'existe pas.",
        ]);

        $userId = $request->input('user_id');
        $departmentId = $request->input('department_id');

        $user = User::findOrFail($userId);
        $this->assertUserIsAssignable($user);

        if ($departmentId) {
            $dept = Department::findOrFail($departmentId);
            if ($dept->agency_id !== $agency->id) {
                return response()->json([
                    'message' => 'Ce département n\'appartient pas à cette agence.',
                ], 422);
            }
        }

        $exists = DB::table('user_assignments')
            ->where('user_id', $userId)
            ->where('agency_id', $agency->id)
            ->first();

        if ($exists) {
            DB::table('user_assignments')
                ->where('user_id', $userId)
                ->where('agency_id', $agency->id)
                ->update([
                    'department_id' => $departmentId,
                    'updated_at' => now(),
                ]);
        } else {
            DB::table('user_assignments')->insert([
                'user_id' => $userId,
                'agency_id' => $agency->id,
                'department_id' => $departmentId,
                'is_primary' => false,
                'is_department_chief' => false,
                'created_at' => now(),
                'updated_at' => now(),
            ]);
        }

        $agency->load('assignedUsers');

        $this->logger->log(
            action: $exists ? 'updated' : 'assigned',
            entityType: 'agency',
            entityId: $agency->id,
            description: "{$user->first_name} {$user->last_name} assigné à l'agence {$agency->code}",
            newValues: ['user_id' => $userId, 'department_id' => $departmentId],
            request: $request,
        );

        return response()->json([
            'message' => 'Utilisateur assigné avec succès.',
            'data' => new AgencyResource($agency),
        ])->setStatusCode(201);
    }

    #[OA\Delete(
        path: '/api/agencies/{agency}/users/{user}',
        summary: 'Retirer un utilisateur d\'une agence',
        tags: ['Agences - Affectations'],
        security: [['sanctum' => []]],
        parameters: [
            new OA\Parameter(name: 'agency', in: 'path', required: true, schema: new OA\Schema(type: 'string', format: 'uuid')),
            new OA\Parameter(name: 'user', in: 'path', required: true, schema: new OA\Schema(type: 'string', format: 'uuid')),
        ],
        responses: [
            new OA\Response(response: 200, description: 'Utilisateur retiré'),
        ]
    )]
    public function removeUser(Request $request, Agency $agency, User $user): JsonResponse
    {
        $this->authorize('update', $agency);

        $hadChiefRole = DB::table('user_assignments')
            ->where('user_id', $user->id)
            ->where('agency_id', $agency->id)
            ->where(function ($q) {
                $q->where('is_primary', true)
                    ->orWhere('is_department_chief', true);
            })
            ->exists();

        DB::table('user_assignments')
            ->where('user_id', $user->id)
            ->where('agency_id', $agency->id)
            ->delete();

        if ($hadChiefRole) {
            $this->clearRoleIfOrphaned($user);
        }

        $agency->load('assignedUsers');

        $this->logger->log(
            action: 'unassigned',
            entityType: 'agency',
            entityId: $agency->id,
            description: "{$user->first_name} {$user->last_name} retiré de l'agence {$agency->code}",
            request: $request,
        );

        return response()->json([
            'message' => 'Utilisateur retiré de l\'agence avec succès.',
            'data' => new AgencyResource($agency),
        ]);
    }

    // ─── Department Chief ────────────────────────────────────────────────

    #[OA\Put(
        path: '/api/departments/{department}/chief',
        summary: 'Assigner un chef de département',
        tags: ['Départements - Affectations'],
        security: [['sanctum' => []]],
        parameters: [
            new OA\Parameter(name: 'department', in: 'path', required: true, schema: new OA\Schema(type: 'string', format: 'uuid')),
        ],
        requestBody: new OA\RequestBody(
            required: true,
            content: new OA\JsonContent(
                required: ['user_id'],
                properties: [
                    new OA\Property(property: 'user_id', type: 'string', format: 'uuid'),
                ]
            )
        ),
        responses: [
            new OA\Response(response: 200, description: 'Chef de département assigné'),
            new OA\Response(response: 422, description: 'Erreur de validation'),
        ]
    )]
    public function assignDepartmentChief(Request $request, Department $department): JsonResponse
    {
        $this->authorize('update', $department);

        $request->validate([
            'user_id' => ['required', 'string', 'exists:users,id'],
        ], [
            'user_id.required' => "L'utilisateur est obligatoire.",
            'user_id.exists' => "Cet utilisateur n'existe pas.",
        ]);

        $userId = $request->input('user_id');
        $user = User::findOrFail($userId);
        $this->assertUserIsAssignable($user);

        $agencyAssignment = DB::table('user_assignments')
            ->where('user_id', $userId)
            ->where('agency_id', $department->agency_id)
            ->first();

        if (! $agencyAssignment) {
            return response()->json([
                'message' => "L'utilisateur doit d'abord être assigné à l'agence \"".($department->agency?->name ?? '').'" pour être nommé chef de département.',
            ], 422);
        }

        DB::transaction(function () use ($department, $userId, $agencyAssignment) {
            $oldChief = DB::table('department_chiefs')
                ->where('department_id', $department->id)
                ->first();

            DB::table('department_chiefs')
                ->where('department_id', $department->id)
                ->delete();

            DB::table('department_chiefs')->insert([
                'id' => (string) Str::uuid(),
                'user_id' => $userId,
                'department_id' => $department->id,
                'created_at' => now(),
                'updated_at' => now(),
            ]);

            if ($agencyAssignment) {
                DB::table('user_assignments')
                    ->where('user_id', $agencyAssignment->user_id)
                    ->where('agency_id', $agencyAssignment->agency_id)
                    ->update(['is_department_chief' => true]);
            }

            if ($oldChief && $oldChief->user_id !== $userId) {
                $oldChiefUser = User::find($oldChief->user_id);
                if ($oldChiefUser) {
                    $this->clearRoleIfOrphaned($oldChiefUser);
                }
            }
        });

        $this->syncRole($user, 'responsable-departement');
        $department->load('assignedUsers');

        $this->logger->log(
            action: 'assigned',
            entityType: 'department',
            entityId: $department->id,
            description: "{$user->first_name} {$user->last_name} nommé chef du département {$department->name}",
            newValues: ['user_id' => $userId],
            request: $request,
        );

        return response()->json([
            'message' => 'Chef de département assigné avec succès.',
            'data' => new DepartmentResource($department),
        ]);
    }

    #[OA\Delete(
        path: '/api/departments/{department}/chief',
        summary: 'Retirer le chef de département',
        tags: ['Départements - Affectations'],
        security: [['sanctum' => []]],
        parameters: [
            new OA\Parameter(name: 'department', in: 'path', required: true, schema: new OA\Schema(type: 'string', format: 'uuid')),
        ],
        responses: [
            new OA\Response(response: 200, description: 'Chef retiré'),
        ]
    )]
    public function removeDepartmentChief(Request $request, Department $department): JsonResponse
    {
        $this->authorize('update', $department);

        $oldChief = DB::table('department_chiefs')
            ->where('department_id', $department->id)
            ->first();

        DB::table('department_chiefs')
            ->where('department_id', $department->id)
            ->delete();

        if ($oldChief) {
            DB::table('user_assignments')
                ->where('user_id', $oldChief->user_id)
                ->where('agency_id', $department->agency_id)
                ->update(['is_department_chief' => false]);

            $oldChiefUser = User::find($oldChief->user_id);
            if ($oldChiefUser) {
                $this->clearRoleIfOrphaned($oldChiefUser);
            }
        }

        $removedChiefId = $oldChief?->user_id ?? 'inconnu';

        $this->logger->log(
            action: 'unassigned',
            entityType: 'department',
            entityId: $department->id,
            description: "Chef du département {$department->name} retiré ({$removedChiefId})",
            request: $request,
        );

        return response()->json(['message' => 'Chef de département retiré avec succès.']);
    }

    // ─── Department Users ────────────────────────────────────────────────

    #[OA\Get(
        path: '/api/departments/{department}/users',
        summary: 'Lister les utilisateurs assignés à un département',
        tags: ['Départements - Affectations'],
        security: [['sanctum' => []]],
        parameters: [
            new OA\Parameter(name: 'department', in: 'path', required: true, schema: new OA\Schema(type: 'string', format: 'uuid')),
        ],
        responses: [
            new OA\Response(response: 200, description: 'Liste des utilisateurs assignés'),
        ]
    )]
    public function listDepartmentUsers(Request $request, Department $department): JsonResponse
    {
        $this->authorize('view', $department);

        $users = $department->assignedUsers()->get();

        return response()->json(UserResource::collection($users));
    }

    #[OA\Post(
        path: '/api/departments/{department}/users',
        summary: 'Assigner un utilisateur à un département',
        tags: ['Départements - Affectations'],
        security: [['sanctum' => []]],
        parameters: [
            new OA\Parameter(name: 'department', in: 'path', required: true, schema: new OA\Schema(type: 'string', format: 'uuid')),
        ],
        requestBody: new OA\RequestBody(
            required: true,
            content: new OA\JsonContent(
                required: ['user_id'],
                properties: [
                    new OA\Property(property: 'user_id', type: 'string', format: 'uuid'),
                ]
            )
        ),
        responses: [
            new OA\Response(response: 201, description: 'Utilisateur assigné'),
            new OA\Response(response: 422, description: 'Erreur de validation'),
        ]
    )]
    public function assignUserToDepartment(Request $request, Department $department): JsonResponse
    {
        $this->authorize('update', $department);

        $request->validate([
            'user_id' => ['required', 'string', 'exists:users,id'],
        ], [
            'user_id.required' => "L'utilisateur est obligatoire.",
            'user_id.exists' => "Cet utilisateur n'existe pas.",
        ]);

        $userId = $request->input('user_id');
        $user = User::findOrFail($userId);
        $this->assertUserIsAssignable($user);

        $exists = DB::table('user_assignments')
            ->where('user_id', $userId)
            ->where('agency_id', $department->agency_id)
            ->first();

        if ($exists) {
            DB::table('user_assignments')
                ->where('user_id', $userId)
                ->where('agency_id', $department->agency_id)
                ->update([
                    'department_id' => $department->id,
                    'updated_at' => now(),
                ]);
        } else {
            DB::table('user_assignments')->insert([
                'user_id' => $userId,
                'agency_id' => $department->agency_id,
                'department_id' => $department->id,
                'is_primary' => false,
                'is_department_chief' => false,
                'created_at' => now(),
                'updated_at' => now(),
            ]);
        }

        $department->load('assignedUsers');

        $this->logger->log(
            action: $exists ? 'updated' : 'assigned',
            entityType: 'department',
            entityId: $department->id,
            description: "{$user->first_name} {$user->last_name} assigné au département {$department->name}",
            newValues: ['user_id' => $userId],
            request: $request,
        );

        return response()->json([
            'message' => 'Utilisateur assigné au département avec succès.',
            'data' => new DepartmentResource($department),
        ])->setStatusCode(201);
    }

    #[OA\Delete(
        path: '/api/departments/{department}/users/{user}',
        summary: 'Retirer un utilisateur d\'un département',
        tags: ['Départements - Affectations'],
        security: [['sanctum' => []]],
        parameters: [
            new OA\Parameter(name: 'department', in: 'path', required: true, schema: new OA\Schema(type: 'string', format: 'uuid')),
            new OA\Parameter(name: 'user', in: 'path', required: true, schema: new OA\Schema(type: 'string', format: 'uuid')),
        ],
        responses: [
            new OA\Response(response: 200, description: 'Utilisateur retiré'),
        ]
    )]
    public function removeUserFromDepartment(Request $request, Department $department, User $user): JsonResponse
    {
        $this->authorize('update', $department);

        $wasDeptChief = DB::table('user_assignments')
            ->where('user_id', $user->id)
            ->where('department_id', $department->id)
            ->where('is_department_chief', true)
            ->exists();

        DB::table('user_assignments')
            ->where('user_id', $user->id)
            ->where('department_id', $department->id)
            ->update(['department_id' => null, 'is_department_chief' => false]);

        if ($wasDeptChief) {
            $this->clearRoleIfOrphaned($user);
        }

        $department->load('assignedUsers');

        $this->logger->log(
            action: 'unassigned',
            entityType: 'department',
            entityId: $department->id,
            description: "{$user->first_name} {$user->last_name} retiré du département {$department->name}",
            request: $request,
        );

        return response()->json([
            'message' => 'Utilisateur retiré du département avec succès.',
            'data' => new DepartmentResource($department),
        ]);
    }
}
