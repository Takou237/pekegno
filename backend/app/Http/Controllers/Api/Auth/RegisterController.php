<?php

namespace App\Http\Controllers\Api\Auth;

use App\Http\Controllers\Controller;
use App\Services\AuthService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class RegisterController extends Controller
{
    public function __construct(
        private readonly AuthService $authService
    ) {}

    public function __invoke(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'username' => ['required', 'string', 'max:100', 'unique:users,username'],
            'email' => ['required', 'email', 'max:255', 'unique:users,email'],
            'password' => ['required', 'string', 'min:8', 'confirmed'],
            'first_name' => ['sometimes', 'string', 'max:150'],
            'last_name' => ['sometimes', 'string', 'max:150'],
            'phone' => ['sometimes', 'string', 'max:50'],
        ]);

        $result = $this->authService->register(
            data: $validated,
            ip: $request->ip(),
            userAgent: $request->userAgent(),
        );

        return response()->json($result, 201);
    }
}
