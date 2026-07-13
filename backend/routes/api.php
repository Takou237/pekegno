<?php

use App\Http\Controllers\Api\AgencyController;
use App\Http\Controllers\Api\Auth\LoginController;
use App\Http\Controllers\Api\Auth\LogoutController;
use App\Http\Controllers\Api\Auth\RegisterController;
use App\Http\Controllers\Api\CategoryController;
use App\Http\Controllers\Api\DepartmentController;
use App\Http\Controllers\Api\PermissionController;
use App\Http\Controllers\Api\ProfileController;
use App\Http\Controllers\Api\RoleController;
use App\Http\Controllers\Api\RolePermissionController;
use App\Http\Controllers\Api\UserController;
use App\Http\Controllers\Api\UserRoleController;
use Illuminate\Support\Facades\Route;

Route::post('/auth/login', LoginController::class);
Route::post('/auth/register', RegisterController::class);

Route::middleware('auth:sanctum')->group(function () {
    Route::post('/auth/logout', LogoutController::class);
    Route::get('/user', ProfileController::class);

    Route::apiResource('roles', RoleController::class);
    Route::apiResource('permissions', PermissionController::class);
    Route::apiResource('agencies', AgencyController::class);
    Route::apiResource('departments', DepartmentController::class);
    Route::apiResource('categories', CategoryController::class);
    Route::apiResource('users', UserController::class)->only(['index', 'show', 'update', 'destroy']);

    Route::get('/users/{user}/role', [UserRoleController::class, 'show']);
    Route::put('/users/{user}/role', [UserRoleController::class, 'update']);

    Route::get('/roles/{role}/permissions', [RolePermissionController::class, 'listPermissions']);
    Route::post('/roles/{role}/permissions', [RolePermissionController::class, 'assignPermissions']);
});
