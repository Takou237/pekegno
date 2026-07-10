<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Http\Requests\Api\AssignRoleRequest;
use App\Models\User;
use Illuminate\Http\JsonResponse;

class UserRoleController extends Controller
{
    public function assignRole(User $user, AssignRoleRequest $request): JsonResponse
    {
        $roleId = $request->validated('role_id');
        $user->roles()->syncWithoutDetaching([$roleId]);
        return response()->json($user->load('roles'));
    }

    public function removeRole(User $user, string $role): JsonResponse
    {
        $user->roles()->detach($role);
        return response()->json($user->load('roles'));
    }

    public function listRoles(User $user): JsonResponse
    {
        return response()->json($user->load('roles'));
    }
}
