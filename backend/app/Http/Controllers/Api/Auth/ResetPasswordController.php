<?php

namespace App\Http\Controllers\Api\Auth;

use App\Http\Controllers\Controller;
use App\Http\Requests\Api\ResetPasswordRequest;
use App\Models\User;
use Carbon\Carbon;
use Illuminate\Http\JsonResponse;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;
use OpenApi\Attributes as OA;

class ResetPasswordController extends Controller
{
    #[OA\Post(
        path: '/api/auth/reset-password',
        summary: 'Réinitialiser le mot de passe avec un token',
        tags: ['Authentification'],
        requestBody: new OA\RequestBody(
            required: true,
            content: new OA\JsonContent(
                required: ['token', 'email', 'password', 'password_confirmation'],
                properties: [
                    new OA\Property(property: 'token', type: 'string'),
                    new OA\Property(property: 'email', type: 'string', format: 'email'),
                    new OA\Property(property: 'password', type: 'string', format: 'password'),
                    new OA\Property(property: 'password_confirmation', type: 'string'),
                ]
            )
        ),
        responses: [
            new OA\Response(
                response: 200,
                description: 'Mot de passe réinitialisé avec succès'
            ),
            new OA\Response(response: 422, description: 'Token invalide ou expiré'),
        ]
    )]
    public function __invoke(ResetPasswordRequest $request): JsonResponse
    {
        $token = $request->validated('token');
        $email = $request->validated('email');

        $resetToken = DB::table('password_reset_tokens')
            ->where('email', $email)
            ->where('token', hash('sha256', $token))
            ->first();

        if (! $resetToken) {
            return response()->json([
                'message' => 'Ce token de réinitialisation est invalide.',
            ], 422);
        }

        if (Carbon::parse($resetToken->created_at)->diffInMinutes(now()) > 60) {
            DB::table('password_reset_tokens')->where('email', $email)->delete();
            return response()->json([
                'message' => 'Ce token de réinitialisation a expiré.',
            ], 422);
        }

        $user = User::where('email', $email)->first();

        $user->update([
            'password' => Hash::make($request->validated('password')),
        ]);

        $user->tokens()->delete();

        DB::table('password_reset_tokens')->where('email', $email)->delete();

        return response()->json([
            'message' => 'Votre mot de passe a été réinitialisé avec succès.',
        ]);
    }
}
