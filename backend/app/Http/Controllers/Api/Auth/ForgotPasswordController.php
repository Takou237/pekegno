<?php

namespace App\Http\Controllers\Api\Auth;

use App\Http\Controllers\Controller;
use App\Http\Requests\Api\ForgotPasswordRequest;
use App\Mail\ResetPasswordMail;
use App\Models\User;
use Illuminate\Http\JsonResponse;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Mail;
use Illuminate\Support\Str;
use OpenApi\Attributes as OA;
use Throwable;

class ForgotPasswordController extends Controller
{
    #[OA\Post(
        path: '/api/auth/forgot-password',
        summary: 'Demander un lien de réinitialisation de mot de passe',
        tags: ['Authentification'],
        requestBody: new OA\RequestBody(
            required: true,
            content: new OA\JsonContent(
                required: ['email'],
                properties: [
                    new OA\Property(property: 'email', type: 'string', format: 'email', example: 'user@example.com'),
                ]
            )
        ),
        responses: [
            new OA\Response(
                response: 200,
                description: 'Email de réinitialisation envoyé'
            ),
            new OA\Response(response: 422, description: 'Erreur de validation'),
        ]
    )]
    public function __invoke(ForgotPasswordRequest $request): JsonResponse
    {
        $email = $request->validated('email');
        $message = 'Si un compte est associé à cette adresse email, vous recevrez un lien de réinitialisation.';

        // Aucun email envoyé à une adresse inconnue (réponse identique : on ne
        // révèle pas quels comptes existent).
        $user = User::where('email', $email)->first();
        if (! $user) {
            return response()->json(['message' => $message]);
        }

        DB::table('password_reset_tokens')->where('email', $email)->delete();

        $token = Str::random(64);

        DB::table('password_reset_tokens')->insert([
            'email' => $email,
            'token' => hash('sha256', $token),
            'created_at' => now(),
        ]);

        $resetUrl = ($user->role?->name === 'client'
            ? config('app.client_frontend_url', 'http://localhost:5174')
            : config('app.frontend_url', 'http://localhost:5173'))
            .'/reset-password?'.http_build_query(['token' => $token, 'email' => $email]);

        try {
            Mail::to($email)->send(new ResetPasswordMail($resetUrl));
        } catch (Throwable $e) {
            // SMTP mal configuré ou injoignable : on le trace au lieu de renvoyer
            // une erreur 500 opaque à l'utilisateur.
            Log::error('Échec d\'envoi de l\'email de réinitialisation', [
                'user_id' => $user->id,
                'error' => $e->getMessage(),
            ]);

            return response()->json([
                'message' => 'L\'email de réinitialisation n\'a pas pu être envoyé. Réessayez plus tard ou contactez un administrateur.',
            ], 503);
        }

        return response()->json(['message' => $message]);
    }
}
