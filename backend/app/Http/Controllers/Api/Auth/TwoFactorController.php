<?php

namespace App\Http\Controllers\Api\Auth;

use App\Http\Controllers\Controller;
use App\Http\Requests\Api\TwoFactorDisableRequest;
use App\Http\Requests\Api\TwoFactorLoginRequest;
use App\Http\Requests\Api\TwoFactorVerifyRequest;
use App\Http\Resources\UserResource;
use App\Mail\TwoFactorCodeMail;
use App\Models\User;
use App\Services\TwoFactorService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Crypt;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Mail;
use OpenApi\Attributes as OA;
use Throwable;

class TwoFactorController extends Controller
{
    public function __construct(
        private readonly TwoFactorService $twoFactorService
    ) {}

    #[OA\Post(
        path: '/api/auth/2fa/enable',
        summary: 'Activer la double authentification (canal totp : secret + QR code ; canal email : envoi du premier code)',
        tags: ['Authentification 2FA'],
        security: [['sanctum' => []]],
        requestBody: new OA\RequestBody(
            content: new OA\JsonContent(
                properties: [
                    new OA\Property(property: 'channel', type: 'string', enum: ['totp', 'email'], default: 'totp'),
                ]
            )
        ),
        responses: [
            new OA\Response(
                response: 200,
                description: 'Canal totp : secret + URL QR code. Canal email : code envoyé par email.',
                content: new OA\JsonContent(
                    properties: [
                        new OA\Property(property: 'channel', type: 'string', enum: ['totp', 'email']),
                        new OA\Property(property: 'secret', type: 'string', nullable: true),
                        new OA\Property(property: 'qr_code_url', type: 'string', nullable: true),
                        new OA\Property(property: 'masked_email', type: 'string', nullable: true),
                    ]
                )
            ),
            new OA\Response(response: 401, description: 'Non authentifié'),
            new OA\Response(response: 422, description: 'Canal invalide ou email manquant'),
            new OA\Response(response: 429, description: 'Trop d’envois rapprochés'),
        ]
    )]
    public function enable(Request $request): JsonResponse
    {
        $user = $request->user();

        // Portail client : uniquement le canal email (pas d'app authenticator
        // imposée aux clients). Le staff garde le choix totp/email.
        $isClient = $user->role?->name === 'client';
        $channel = $isClient ? 'email' : $request->input('channel', 'totp');

        if (! in_array($channel, ['totp', 'email'], true)) {
            return response()->json([
                'message' => 'Canal invalide. Valeurs acceptées : totp, email.',
            ], 422);
        }

        if ($channel === 'email') {
            if (! $user->email) {
                return response()->json([
                    'message' => 'Aucune adresse email sur ce compte : impossible d’utiliser la 2FA par email.',
                ], 422);
            }

            $remaining = $this->twoFactorService->emailResendCooldownRemaining($user);

            if ($remaining > 0) {
                return response()->json([
                    'message' => "Un code a déjà été envoyé. Réessayez dans {$remaining} secondes.",
                    'retry_after' => $remaining,
                ], 429);
            }

            // Marqueur chiffré : le déclencheur 2FA du reste de l'application teste
            // two_factor_enabled && two_factor_secret. Ce secret n'est JAMAIS utilisé
            // pour un calcul TOTP quand le canal est email.
            $user->update([
                'two_factor_secret' => Crypt::encrypt($this->twoFactorService->generateSecretKey()),
                'two_factor_channel' => 'email',
            ]);

            $sent = $this->sendEmailCode($user);

            if (! $sent) {
                return response()->json([
                    'message' => 'Impossible d’envoyer l’email pour le moment (serveur SMTP indisponible). Réessayez plus tard.',
                ], 503);
            }

            return response()->json([
                'channel' => 'email',
                'masked_email' => $this->maskEmail($user->email),
            ]);
        }

        $secret = $this->twoFactorService->generateSecretKey();
        $qrCodeUrl = $this->twoFactorService->getQRCodeUrl($user->email, $secret);

        $user->update([
            'two_factor_secret' => Crypt::encrypt($secret),
            'two_factor_channel' => 'totp',
        ]);

        return response()->json([
            'channel' => 'totp',
            'secret' => $secret,
            'qr_code_url' => $qrCodeUrl,
        ]);
    }

    #[OA\Post(
        path: '/api/auth/2fa/verify',
        summary: 'Vérifier le code (TOTP ou email selon le canal) et activer la 2FA',
        tags: ['Authentification 2FA'],
        security: [['sanctum' => []]],
        requestBody: new OA\RequestBody(
            required: true,
            content: new OA\JsonContent(
                required: ['code'],
                properties: [
                    new OA\Property(property: 'code', type: 'string', example: '123456'),
                ]
            )
        ),
        responses: [
            new OA\Response(response: 200, description: '2FA activée avec succès'),
            new OA\Response(response: 422, description: 'Code invalide'),
        ]
    )]
    public function verify(TwoFactorVerifyRequest $request): JsonResponse
    {
        $user = $request->user();

        if (! $user->two_factor_secret) {
            return response()->json([
                'message' => 'Vous devez d\'abord activer la 2FA.',
            ], 422);
        }

        if ($user->two_factor_channel === 'email') {
            if (! $this->twoFactorService->verifyEmailCode($user, $request->validated('code'))) {
                return response()->json([
                    'message' => 'Le code de vérification est invalide ou expiré.',
                ], 422);
            }
        } else {
            $secret = Crypt::decrypt($user->two_factor_secret);

            if (! $this->twoFactorService->verifyKey($secret, $request->validated('code'))) {
                return response()->json([
                    'message' => 'Le code de vérification est invalide.',
                ], 422);
            }
        }

        $user->update([
            'two_factor_enabled' => true,
        ]);

        return response()->json([
            'message' => 'La double authentification a été activée avec succès.',
        ]);
    }

    #[OA\Post(
        path: '/api/auth/2fa/disable',
        summary: 'Désactiver la double authentification (mot de passe + code du canal actif)',
        tags: ['Authentification 2FA'],
        security: [['sanctum' => []]],
        requestBody: new OA\RequestBody(
            required: true,
            content: new OA\JsonContent(
                required: ['password', 'code'],
                properties: [
                    new OA\Property(property: 'password', type: 'string', format: 'password'),
                    new OA\Property(property: 'code', type: 'string', example: '123456'),
                ]
            )
        ),
        responses: [
            new OA\Response(response: 200, description: '2FA désactivée avec succès'),
            new OA\Response(response: 422, description: 'Mot de passe ou code invalide'),
        ]
    )]
    public function disable(TwoFactorDisableRequest $request): JsonResponse
    {
        $user = $request->user();

        if (! Hash::check($request->validated('password'), $user->password)) {
            return response()->json([
                'message' => 'Le mot de passe est incorrect.',
            ], 422);
        }

        if (! $user->two_factor_enabled || ! $user->two_factor_secret) {
            return response()->json([
                'message' => 'La double authentification n\'est pas activée.',
            ], 422);
        }

        if (! $this->twoFactorService->verifyCodeForUser($user, $request->validated('code'))) {
            return response()->json([
                'message' => 'Le code de vérification est invalide ou expiré.',
            ], 422);
        }

        $user->update([
            'two_factor_enabled' => false,
            'two_factor_secret' => null,
            'two_factor_channel' => 'totp',
        ]);

        $this->twoFactorService->forgetEmailCode($user);

        return response()->json([
            'message' => 'La double authentification a été désactivée avec succès.',
        ]);
    }

    #[OA\Post(
        path: '/api/auth/2fa/login',
        summary: 'Vérifier le code 2FA lors de la connexion (TOTP ou email selon le canal)',
        tags: ['Authentification 2FA'],
        requestBody: new OA\RequestBody(
            required: true,
            content: new OA\JsonContent(
                required: ['temp_token', 'code'],
                properties: [
                    new OA\Property(property: 'temp_token', type: 'string'),
                    new OA\Property(property: 'code', type: 'string', example: '123456'),
                ]
            )
        ),
        responses: [
            new OA\Response(
                response: 200,
                description: 'Connexion réussie',
                content: new OA\JsonContent(
                    properties: [
                        new OA\Property(property: 'user', ref: '#/components/schemas/User'),
                        new OA\Property(property: 'token', type: 'string'),
                    ]
                )
            ),
            new OA\Response(response: 422, description: 'Token ou code invalide'),
        ]
    )]
    public function login(TwoFactorLoginRequest $request): JsonResponse
    {
        $tokenData = Cache::get('2fa_temp_token:'.$request->validated('temp_token'));

        if (! $tokenData) {
            return response()->json([
                'message' => 'Ce token temporaire est invalide ou a expiré.',
            ], 422);
        }

        $user = User::with('role')->find($tokenData['user_id']);

        if (! $user || ! $user->two_factor_enabled) {
            Cache::forget('2fa_temp_token:'.$request->validated('temp_token'));

            return response()->json([
                'message' => 'Utilisateur invalide.',
            ], 422);
        }

        if (! $this->twoFactorService->verifyCodeForUser($user, $request->validated('code'))) {
            $attempts = ($tokenData['attempts'] ?? 0) + 1;

            if ($attempts >= 5) {
                Cache::forget('2fa_temp_token:'.$request->validated('temp_token'));

                return response()->json([
                    'message' => 'Trop de tentatives échouées. Veuillez vous reconnecter.',
                ], 422);
            }

            Cache::put(
                '2fa_temp_token:'.$request->validated('temp_token'),
                array_merge($tokenData, ['attempts' => $attempts]),
                300
            );

            return response()->json([
                'message' => 'Le code de vérification est invalide ou expiré.',
            ], 422);
        }        Cache::forget('2fa_temp_token:'.$request->validated('temp_token'));

        // Les clients n'ont pas de session unique (pas de middleware
        // single.session) : pas d'active_session_id pour eux.
        $isClient = $user->role?->name === 'client';

        $accessToken = $user->createToken($isClient ? 'client-token' : 'auth-token');
        $token = $accessToken->plainTextToken;

        $update = ['last_activity_at' => now()];

        if (! $isClient) {
            $update['active_session_id'] = $accessToken->accessToken->id;
        }

        $user->update($update);

        return response()->json([
            // UserResource, comme le login classique et GET /user : sinon le champ
            // calculé "name" est absent du modèle brut (pas de colonne "name").
            'user' => new UserResource($user->load('assignments')),
            'token' => $token,
        ]);
    }

    #[OA\Post(
        path: '/api/auth/2fa/email/resend',
        summary: 'Renvoyer un code email pendant un défi 2FA de connexion',
        tags: ['Authentification 2FA'],
        requestBody: new OA\RequestBody(
            required: true,
            content: new OA\JsonContent(
                required: ['temp_token'],
                properties: [
                    new OA\Property(property: 'temp_token', type: 'string'),
                ]
            )
        ),
        responses: [
            new OA\Response(response: 200, description: 'Nouveau code envoyé'),
            new OA\Response(response: 422, description: 'Token invalide ou canal non email'),
            new OA\Response(response: 429, description: 'Délai de renvoi non écoulé'),
            new OA\Response(response: 503, description: 'Serveur SMTP indisponible'),
        ]
    )]
    public function resendEmailCode(Request $request): JsonResponse
    {
        $tempToken = (string) $request->input('temp_token');
        $tokenData = Cache::get('2fa_temp_token:'.$tempToken);

        if (! $tokenData) {
            return response()->json([
                'message' => 'Ce token temporaire est invalide ou a expiré.',
            ], 422);
        }

        $user = User::find($tokenData['user_id']);

        if (! $user || ! $user->two_factor_enabled || $user->two_factor_channel !== 'email') {
            return response()->json([
                'message' => 'Aucun code email en attente pour ce compte.',
            ], 422);
        }

        $remaining = $this->twoFactorService->emailResendCooldownRemaining($user);

        if ($remaining > 0) {
            return response()->json([
                'message' => "Un code a déjà été envoyé. Réessayez dans {$remaining} secondes.",
                'retry_after' => $remaining,
            ], 429);
        }

        if (! $this->sendEmailCode($user)) {
            return response()->json([
                'message' => 'Impossible d’envoyer l’email pour le moment (serveur SMTP indisponible). Réessayez plus tard.',
            ], 503);
        }

        return response()->json([
            'message' => 'Un nouveau code a été envoyé à votre adresse email.',
        ]);
    }

    #[OA\Post(
        path: '/api/auth/2fa/email/send',
        summary: 'Envoyer un code email à l’utilisateur connecté (activation ou désactivation de la 2FA)',
        tags: ['Authentification 2FA'],
        security: [['sanctum' => []]],
        responses: [
            new OA\Response(response: 200, description: 'Code envoyé'),
            new OA\Response(response: 422, description: '2FA email non activée'),
            new OA\Response(response: 429, description: 'Délai de renvoi non écoulé'),
            new OA\Response(response: 503, description: 'Serveur SMTP indisponible'),
        ]
    )]
    public function sendEmailCodeToAuthenticated(Request $request): JsonResponse
    {
        $user = $request->user();

        // 'email' suffit : la 2FA peut être en cours d'activation
        // (two_factor_enabled encore false) — le renvoi doit rester possible.
        if ($user->two_factor_channel !== 'email') {
            return response()->json([
                'message' => 'La double authentification par email n’est pas configurée sur ce compte.',
            ], 422);
        }

        $remaining = $this->twoFactorService->emailResendCooldownRemaining($user);

        if ($remaining > 0) {
            return response()->json([
                'message' => "Un code a déjà été envoyé. Réessayez dans {$remaining} secondes.",
                'retry_after' => $remaining,
            ], 429);
        }

        if (! $this->sendEmailCode($user)) {
            return response()->json([
                'message' => 'Impossible d’envoyer l’email pour le moment (serveur SMTP indisponible). Réessayez plus tard.',
            ], 503);
        }

        return response()->json([
            'message' => 'Un code a été envoyé à votre adresse email.',
        ]);
    }

    /**
     * Émet + envoie un code email. Retourne false si l'envoi SMTP échoue
     * (l'échec est journalisé, jamais fatal).
     */
    private function sendEmailCode(User $user): bool
    {
        $code = $this->twoFactorService->issueEmailCode($user);

        try {
            Mail::to($user->email)->send(new TwoFactorCodeMail(
                $code,
                (int) ceil(TwoFactorService::EMAIL_CODE_TTL / 60),
            ));
        } catch (Throwable $e) {
            report($e);

            return false;
        }

        return true;
    }

    private function maskEmail(string $email): string
    {
        [$local, $domain] = array_pad(explode('@', $email, 2), 2, '');

        return substr($local, 0, 2).'***@'.$domain;
    }
}
