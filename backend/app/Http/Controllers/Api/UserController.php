<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\User;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Hash;
use Illuminate\Validation\Rule;
use OpenApi\Attributes as OA;

class UserController extends Controller
{
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
    public function index(Request $request): JsonResponse
    {
        $users = User::with('role', 'agency', 'department')
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

        return response()->json($users);
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
    public function show(User $user): JsonResponse
    {
        return response()->json($user->load('role', 'agency', 'department', 'managedAgencies', 'managedDepartments'));
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
                    new OA\Property(property: 'agency_id', type: 'string', format: 'uuid'),
                    new OA\Property(property: 'department_id', type: 'string', format: 'uuid'),
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
    public function update(Request $request, User $user): JsonResponse
    {
        $validated = $request->validate([
            'username' => ['sometimes', 'string', 'max:100', Rule::unique('users')->ignore($user)],
            'email' => ['sometimes', 'email', 'max:255', Rule::unique('users')->ignore($user)],
            'first_name' => ['sometimes', 'nullable', 'string', 'max:150'],
            'last_name' => ['sometimes', 'nullable', 'string', 'max:150'],
            'phone' => ['sometimes', 'nullable', 'string', 'max:50'],
            'is_active' => ['sometimes', 'boolean'],
            'role_id' => ['sometimes', 'nullable', 'uuid', 'exists:roles,id'],
            'agency_id' => ['sometimes', 'nullable', 'uuid', 'exists:agencies,id'],
            'department_id' => ['sometimes', 'nullable', 'uuid', 'exists:departments,id'],
            'is_password_change_required' => ['sometimes', 'boolean'],
        ]);

        if ($request->filled('password')) {
            $request->validate(['password' => ['string', 'min:8', 'confirmed']]);
            $validated['password'] = Hash::make($request->password);
        }

        $user->update($validated);
        return response()->json($user->fresh()->load('role', 'agency', 'department'));
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
    public function destroy(User $user): JsonResponse
    {
        if ($user->role && $user->role->is_system) {
            return response()->json(['message' => 'Impossible de supprimer un utilisateur avec un rôle système.'], 403);
        }
        $user->delete();
        return response()->json(null, 204);
    }
}
