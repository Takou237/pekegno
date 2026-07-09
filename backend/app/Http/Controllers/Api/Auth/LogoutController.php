<?php

namespace App\Http\Controllers\Api\Auth;

use App\Http\Controllers\Controller;
use App\Services\AuthService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class LogoutController extends Controller
{
    public function __construct(
        private readonly AuthService $authService
    ) {}

    public function __invoke(Request $request): JsonResponse
    {
        $this->authService->logout(
            user: $request->user(),
            ip: $request->ip(),
            userAgent: $request->userAgent(),
        );

        return response()->json(['message' => 'Déconnexion réussie.']);
    }
}
