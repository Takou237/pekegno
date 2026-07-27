<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Http\Resources\UserResource;
use App\Models\Agency;
use App\Models\Department;
use App\Models\User;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use OpenApi\Attributes as OA;

class UserAssignmentController extends Controller
{
    // ─── Agency ───────────────────────────────────────────────────────────

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

        DB::transaction(function () use ($agency, $userId) {
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
                    'created_at' => now(),
                    'updated_at' => now(),
                ]);
            }
        });

        $agency->load('assignedUsers');

        return response()->json([
            'message' => 'Chef d\'agence assigné avec succès.',
            'data' => $agency,
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

        DB::table('user_assignments')
            ->where('agency_id', $agency->id)
            ->where('is_primary', true)
            ->update(['is_primary' => false]);

        return response()->json(['message' => 'Chef d\'agence retiré avec succès.']);
    }

    // ─── Agency Users (assignation générale) ──────────────────────────────

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

        return response()->json([
            'data' => UserResource::collection($users),
        ]);
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
                'created_at' => now(),
                'updated_at' => now(),
            ]);
        }

        $agency->load('assignedUsers');

        return response()->json([
            'message' => 'Utilisateur assigné avec succès.',
            'data' => $agency,
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

        DB::table('user_assignments')
            ->where('user_id', $user->id)
            ->where('agency_id', $agency->id)
            ->delete();

        $agency->load('assignedUsers');

        return response()->json([
            'message' => 'Utilisateur retiré de l\'agence avec succès.',
            'data' => $agency,
        ]);
    }

    // ─── Department Users ─────────────────────────────────────────────────

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

        return response()->json([
            'data' => UserResource::collection($users),
        ]);
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
                'created_at' => now(),
                'updated_at' => now(),
            ]);
        }

        $department->load('assignedUsers');

        return response()->json([
            'message' => 'Utilisateur assigné au département avec succès.',
            'data' => $department,
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

        DB::table('user_assignments')
            ->where('user_id', $user->id)
            ->where('department_id', $department->id)
            ->update(['department_id' => null]);

        $department->load('assignedUsers');

        return response()->json([
            'message' => 'Utilisateur retiré du département avec succès.',
            'data' => $department,
        ]);
    }
}
