<?php

namespace App\Http\Controllers\Api\Auth;

use App\Http\Controllers\Controller;
use App\Http\Requests\Api\ForgotPasswordRequest;
use App\Mail\ResetPasswordMail;
use Illuminate\Http\JsonResponse;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Mail;
use Illuminate\Support\Str;
use OpenApi\Attributes as OA;

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

        DB::table('password_reset_tokens')->where('email', $email)->delete();

        $token = Str::random(64);

        DB::table('password_reset_tokens')->insert([
            'email' => $email,
            'token' => hash('sha256', $token),
            'created_at' => now(),
        ]);

        $resetUrl = config('app.frontend_url', 'http://localhost:5173')
            . "/reset-password?token={$token}&email={$email}";

        Mail::to($email)->send(new ResetPasswordMail($resetUrl));

        return response()->json([
            'message' => 'Si un compte est associé à cette adresse email, vous recevrez un lien de réinitialisation.',
        ]);
    }
}
