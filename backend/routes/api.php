<?php

use App\Http\Controllers\Api\AgencyController;
use App\Http\Controllers\Api\Auth\ChangePasswordController;
use App\Http\Controllers\Api\Auth\DeleteAccountController;
use App\Http\Controllers\Api\Auth\ForgotPasswordController;
use App\Http\Controllers\Api\Auth\LoginController;
use App\Http\Controllers\Api\Auth\LogoutController;
use App\Http\Controllers\Api\Auth\RegisterController;
use App\Http\Controllers\Api\Auth\ResetPasswordController;
use App\Http\Controllers\Api\Auth\TwoFactorController;
use App\Http\Controllers\Api\CategoryController;
use App\Http\Controllers\Api\ClientController;
use App\Http\Controllers\Api\CommercialController;
use App\Http\Controllers\Api\DepartmentController;
use App\Http\Controllers\Api\ExportController;
use App\Http\Controllers\Api\InvoiceController;
use App\Http\Controllers\Api\ProfileController;
use App\Http\Controllers\Api\PermissionController;
use App\Http\Controllers\Api\PromotionController;
use App\Http\Controllers\Api\RoleController;
use App\Http\Controllers\Api\ServiceController;
use App\Http\Controllers\Api\UploadController;
use App\Http\Controllers\Api\UserAssignmentController;
use App\Http\Controllers\Api\UserController;
use App\Http\Controllers\Api\UserRoleController;
use Illuminate\Support\Facades\Route;

Route::post('/auth/login', LoginController::class);
Route::post('/auth/register', RegisterController::class);
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
    Route::get('/services/search', [ServiceController::class, 'search'])->middleware('permission:services.consulter');
    Route::post('/services/{service}/restore', [ServiceController::class, 'restore']);
    Route::delete('/services/{service}/force-delete', [ServiceController::class, 'forceDelete']);
    Route::apiResource('services', ServiceController::class);

    Route::post('/uploads', [UploadController::class, 'store']);

    Route::get('/clients/search', [ClientController::class, 'search'])->middleware('permission:clients.consulter');
    Route::get('/clients', [ClientController::class, 'index'])->middleware('permission:clients.consulter');
    Route::post('/clients', [ClientController::class, 'store'])->middleware('permission:clients.creer');
    Route::get('/clients/{client}', [ClientController::class, 'show'])->middleware('permission:clients.consulter');
    Route::put('/clients/{client}', [ClientController::class, 'update'])->middleware('permission:clients.modifier');
    Route::delete('/clients/{client}', [ClientController::class, 'destroy'])->middleware('permission:clients.supprimer');

    Route::get('/commercials/search', [CommercialController::class, 'search'])->middleware('permission:commercials.consulter');
    Route::get('/commercials/available-users', [CommercialController::class, 'availableUsers'])->middleware('permission:commercials.consulter');
    Route::get('/commercials/ranking', [CommercialController::class, 'ranking'])->middleware('permission:commercials.consulter');
    Route::get('/commercials/{commercial}/stats', [CommercialController::class, 'stats'])->middleware('permission:commercials.consulter');
    Route::post('/commercials/{commercial}/points', [CommercialController::class, 'adjustPoints'])->middleware('permission:commercials.modifier');
    Route::get('/commercials', [CommercialController::class, 'index'])->middleware('permission:commercials.consulter');
    Route::post('/commercials', [CommercialController::class, 'store'])->middleware('permission:commercials.creer');
    Route::get('/commercials/{commercial}', [CommercialController::class, 'show'])->middleware('permission:commercials.consulter');
    Route::put('/commercials/{commercial}', [CommercialController::class, 'update'])->middleware('permission:commercials.modifier');
    Route::delete('/commercials/{commercial}', [CommercialController::class, 'destroy'])->middleware('permission:commercials.supprimer');

    Route::get('/invoices', [InvoiceController::class, 'index'])->middleware('permission:invoices.consulter');
    Route::post('/invoices', [InvoiceController::class, 'store'])->middleware('permission:invoices.creer');
    Route::get('/invoices/{invoice}', [InvoiceController::class, 'show'])->middleware('permission:invoices.consulter');
    Route::put('/invoices/{invoice}', [InvoiceController::class, 'update'])->middleware('permission:invoices.modifier');
    Route::post('/invoices/{invoice}/payments', [InvoiceController::class, 'pay'])->middleware('permission:invoices.encaisser');
    Route::post('/invoices/{invoice}/cancel', [InvoiceController::class, 'cancel'])->middleware('permission:invoices.annuler');

    Route::get('/promotions', [PromotionController::class, 'index'])->middleware('permission:promotions.consulter');
    Route::post('/services/{service}/promotions', [PromotionController::class, 'store'])->middleware('permission:promotions.creer');
    Route::put('/promotions/{promotion}', [PromotionController::class, 'update'])->middleware('permission:promotions.modifier');
    Route::delete('/promotions/{promotion}', [PromotionController::class, 'destroy'])->middleware('permission:promotions.supprimer');

    Route::get('/exports/agencies', [ExportController::class, 'agencies']);
    Route::get('/exports/users', [ExportController::class, 'users']);
    Route::get('/exports/services', [ExportController::class, 'services']);

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
    Route::post('/roles', [RoleController::class, 'store']);
    Route::put('/roles/{role}', [RoleController::class, 'update']);
    Route::delete('/roles/{role}', [RoleController::class, 'destroy']);
    Route::put('/roles/{role}/permissions', [RoleController::class, 'syncPermissions']);

    Route::get('/permissions', [PermissionController::class, 'index']);
    Route::post('/permissions', [PermissionController::class, 'store']);
    Route::put('/permissions/{permission}', [PermissionController::class, 'update']);
    Route::delete('/permissions/{permission}', [PermissionController::class, 'destroy']);
});
