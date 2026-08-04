<?php

use App\Http\Controllers\Api\AgencyController;
use App\Http\Controllers\Api\Auth\ChangePasswordController;
use App\Http\Controllers\Api\Auth\DeleteAccountController;
use App\Http\Controllers\Api\Auth\ForgotPasswordController;
use App\Http\Controllers\Api\Auth\LoginController;
use App\Http\Controllers\Api\Auth\LogoutController;
use App\Http\Controllers\Api\Auth\ResetPasswordController;
use App\Http\Controllers\Api\Auth\TwoFactorController;
use App\Http\Controllers\Api\CategoryController;
use App\Http\Controllers\Api\DepartmentController;
use App\Http\Controllers\Api\FormationController;
use App\Http\Controllers\Api\ModuleController;
use App\Http\Controllers\Api\ProfileController;
use App\Http\Controllers\Api\RoleController;
use App\Http\Controllers\Api\ServiceController;
use App\Http\Controllers\Api\UploadController;
use App\Http\Controllers\Api\UserAssignmentController;
use App\Http\Controllers\Api\UserController;
use App\Http\Controllers\Api\UserRoleController;
use Illuminate\Support\Facades\Route;

Route::post('/auth/login', LoginController::class);
Route::post('/auth/forgot-password', ForgotPasswordController::class);
Route::post('/auth/reset-password', ResetPasswordController::class);
Route::post('/auth/2fa/login', [TwoFactorController::class, 'login']);

Route::middleware(['auth:sanctum', 'single.session', 'update.activity', 'inactivity.logout'])->group(function () {
    Route::post('/auth/logout', LogoutController::class);
    Route::put('/auth/change-password', ChangePasswordController::class);
    Route::delete('/auth/account', DeleteAccountController::class);
    Route::get('/user', ProfileController::class);

    Route::post('/auth/2fa/enable', [TwoFactorController::class, 'enable']);
    Route::post('/auth/2fa/verify', [TwoFactorController::class, 'verify']);
    Route::post('/auth/2fa/disable', [TwoFactorController::class, 'disable']);

    Route::get('/agencies/trash', [AgencyController::class, 'trash']);
    Route::post('/agencies/{agency}/restore', [AgencyController::class, 'restore']);
    Route::delete('/agencies/{agency}/force-delete', [AgencyController::class, 'forceDelete']);
    Route::apiResource('agencies', AgencyController::class);

    Route::get('/categories/trash', [CategoryController::class, 'trash']);
    Route::post('/categories/{category}/restore', [CategoryController::class, 'restore']);
    Route::delete('/categories/{category}/force-delete', [CategoryController::class, 'forceDelete']);
    Route::apiResource('categories', CategoryController::class);

    Route::get('/services/trash', [ServiceController::class, 'trash']);
    Route::post('/services/{service}/restore', [ServiceController::class, 'restore']);
    Route::delete('/services/{service}/force-delete', [ServiceController::class, 'forceDelete']);
    Route::apiResource('services', ServiceController::class);

    Route::apiResource('formations', FormationController::class);
    Route::post('/modules/reorder', [ModuleController::class, 'reorder']);
    Route::apiResource('modules', ModuleController::class);

    Route::post('/uploads', [UploadController::class, 'store']);

    Route::put('/agencies/{agency}/chief', [UserAssignmentController::class, 'assignChief']);
    Route::delete('/agencies/{agency}/chief', [UserAssignmentController::class, 'removeChief']);
    Route::get('/agencies/{agency}/users', [UserAssignmentController::class, 'listAgencyUsers']);
    Route::post('/agencies/{agency}/users', [UserAssignmentController::class, 'assignUser']);
    Route::delete('/agencies/{agency}/users/{user}', [UserAssignmentController::class, 'removeUser']);

    Route::put('/departments/{department}/chief', [UserAssignmentController::class, 'assignDepartmentChief']);
    Route::delete('/departments/{department}/chief', [UserAssignmentController::class, 'removeDepartmentChief']);
    Route::get('/departments/trash', [DepartmentController::class, 'trash']);
    Route::post('/departments/{department}/restore', [DepartmentController::class, 'restore']);
    Route::delete('/departments/{department}/force-delete', [DepartmentController::class, 'forceDelete']);
    Route::apiResource('departments', DepartmentController::class);
    Route::get('/departments/{department}/users', [UserAssignmentController::class, 'listDepartmentUsers']);
    Route::post('/departments/{department}/users', [UserAssignmentController::class, 'assignUserToDepartment']);
    Route::delete('/departments/{department}/users/{user}', [UserAssignmentController::class, 'removeUserFromDepartment']);
    Route::apiResource('users', UserController::class)->only(['index', 'store', 'show', 'update', 'destroy']);

    Route::get('/users/{user}/role', [UserRoleController::class, 'show']);
    Route::put('/users/{user}/role', [UserRoleController::class, 'update']);

    Route::get('/roles', [RoleController::class, 'index']);
});
