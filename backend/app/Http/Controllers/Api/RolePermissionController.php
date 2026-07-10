<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Http\Requests\Api\AssignPermissionRequest;
use App\Models\Role;
use Illuminate\Http\JsonResponse;

class RolePermissionController extends Controller
{
    public function assignPermissions(Role $role, AssignPermissionRequest $request): JsonResponse
    {
        $role->permissions()->sync($request->validated('permissions'));
        return response()->json($role->load('permissions'));
    }

    public function listPermissions(Role $role): JsonResponse
    {
        return response()->json($role->load('permissions'));
    }
}
