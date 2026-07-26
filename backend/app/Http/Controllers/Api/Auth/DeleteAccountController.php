<?php

namespace App\Http\Controllers\Api\Auth;

use App\Http\Controllers\Controller;
use App\Http\Requests\Api\DeleteAccountRequest;
use App\Models\LoginLog;
use App\Models\Role;
use App\Models\User;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Hash;
use OpenApi\Attributes as OA;

class DeleteAccountController extends Controller
{
    #[OA\Delete(
        path: '/api/auth/account',
        summary: 'Supprimer le compte de l\'utilisateur connecté',
        tags: ['Authentification'],
        security: [['sanctum' => []]],
        requestBody: new OA\RequestBody(
            required: true,
            content: new OA\JsonContent(
                required: ['password'],
                properties: [
                    new OA\Property(property: 'password', type: 'string', format: 'password'),
                ]
            )
        ),
        responses: [
            new OA\Response(
                response: 200,
                description: 'Compte supprimé avec succès'
            ),
            new OA\Response(response: 401, description: 'Non authentifié'),
            new OA\Response(response: 422, description: 'Mot de passe incorrect'),
        ]
    )]
    public function __invoke(DeleteAccountRequest $request): JsonResponse
    {
        $user = $request->user();

        if (! Hash::check($request->validated('password'), $user->password)) {
            return response()->json([
                'message' => 'Le mot de passe est incorrect.',
            ], 422);
        }

        $superAdminRole = Role::where('name', 'super-admin')->first();

        if ($superAdminRole && $user->role_id === $superAdminRole->id) {
            $superAdminCount = User::where('role_id', $superAdminRole->id)->count();

            if ($superAdminCount <= 1) {
                return response()->json([
                    'message' => 'Vous ne pouvez pas supprimer le compte du dernier super-administrateur.',
                ], 422);
            }
        }

        LoginLog::create([
            'user_id' => $user->id,
            'action' => 'account_deleted',
            'ip_address' => $request->ip(),
            'user_agent' => $request->userAgent(),
        ]);

        $user->tokens()->delete();
        $user->delete();

        return response()->json([
            'message' => 'Votre compte a été supprimé avec succès.',
        ]);
    }
}
