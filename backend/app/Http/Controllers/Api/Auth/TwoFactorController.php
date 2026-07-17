<?php

namespace App\Http\Controllers\Api\Auth;

use App\Http\Controllers\Controller;
use App\Http\Requests\Api\TwoFactorDisableRequest;
use App\Http\Requests\Api\TwoFactorLoginRequest;
use App\Http\Requests\Api\TwoFactorVerifyRequest;
use App\Models\User;
use App\Services\TwoFactorService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Crypt;
use Illuminate\Support\Facades\Hash;
use OpenApi\Attributes as OA;

class TwoFactorController extends Controller
{
    public function __construct(
        private readonly TwoFactorService $twoFactorService
    ) {}

    #[OA\Post(
        path: '/api/auth/2fa/enable',
        summary: 'Activer la double authentification (générer le secret)',
        tags: ['Authentification 2FA'],
        security: [['sanctum' => []]],
        responses: [
            new OA\Response(
                response: 200,
                description: 'Secret et URL QR code générés',
                content: new OA\JsonContent(
                    properties: [
                        new OA\Property(property: 'secret', type: 'string'),
                        new OA\Property(property: 'qr_code_url', type: 'string'),
                    ]
                )
            ),
            new OA\Response(response: 401, description: 'Non authentifié'),
        ]
    )]
    public function enable(Request $request): JsonResponse
    {
        $user = $request->user();
        $secret = $this->twoFactorService->generateSecretKey();
        $qrCodeUrl = $this->twoFactorService->getQRCodeUrl($user->email, $secret);

        $user->update([
            'two_factor_secret' => Crypt::encrypt($secret),
        ]);

        return response()->json([
            'secret' => $secret,
            'qr_code_url' => $qrCodeUrl,
        ]);
    }

    #[OA\Post(
        path: '/api/auth/2fa/verify',
        summary: 'Vérifier et activer la 2FA',
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
            new OA\Response(
                response: 200,
                description: '2FA activée avec succès'
            ),
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

        $secret = Crypt::decrypt($user->two_factor_secret);

        if (! $this->twoFactorService->verifyKey($secret, $request->validated('code'))) {
            return response()->json([
                'message' => 'Le code de vérification est invalide.',
            ], 422);
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
        summary: 'Désactiver la double authentification',
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
            new OA\Response(
                response: 200,
                description: '2FA désactivée avec succès'
            ),
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

        $secret = Crypt::decrypt($user->two_factor_secret);

        if (! $this->twoFactorService->verifyKey($secret, $request->validated('code'))) {
            return response()->json([
                'message' => 'Le code de vérification est invalide.',
            ], 422);
        }

        $user->update([
            'two_factor_enabled' => false,
            'two_factor_secret' => null,
        ]);

        return response()->json([
            'message' => 'La double authentification a été désactivée avec succès.',
        ]);
    }

    #[OA\Post(
        path: '/api/auth/2fa/login',
        summary: 'Vérifier le code 2FA lors de la connexion',
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
        $tokenData = Cache::get('2fa_temp_token:' . $request->validated('temp_token'));

        if (! $tokenData) {
            return response()->json([
                'message' => 'Ce token temporaire est invalide ou a expiré.',
            ], 422);
        }

        $user = User::with('role')->find($tokenData['user_id']);

        if (! $user || ! $user->two_factor_enabled) {
            Cache::forget('2fa_temp_token:' . $request->validated('temp_token'));
            return response()->json([
                'message' => 'Utilisateur invalide.',
            ], 422);
        }

        $secret = Crypt::decrypt($user->two_factor_secret);

        if (! $this->twoFactorService->verifyKey($secret, $request->validated('code'))) {
            $attempts = ($tokenData['attempts'] ?? 0) + 1;

            if ($attempts >= 5) {
                Cache::forget('2fa_temp_token:' . $request->validated('temp_token'));
                return response()->json([
                    'message' => 'Trop de tentatives échouées. Veuillez vous reconnecter.',
                ], 422);
            }

            Cache::put(
                '2fa_temp_token:' . $request->validated('temp_token'),
                array_merge($tokenData, ['attempts' => $attempts]),
                300
            );

            return response()->json([
                'message' => 'Le code de vérification est invalide.',
            ], 422);
        }

        Cache::forget('2fa_temp_token:' . $request->validated('temp_token'));

        $token = $user->createToken('auth-token')->plainTextToken;

        return response()->json([
            'user' => $user,
            'token' => $token,
        ]);
    }
}
