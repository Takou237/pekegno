<?php

use App\Http\Controllers\Api\AccountingCategoryController;
use App\Http\Controllers\Api\AccountingController;
use App\Http\Controllers\Api\ActivityLogController;
use App\Http\Controllers\Api\AgencyController;
use App\Http\Controllers\Api\Auth\ChangePasswordController;
use App\Http\Controllers\Api\Auth\DeleteAccountController;
use App\Http\Controllers\Api\Auth\ForgotPasswordController;
use App\Http\Controllers\Api\Auth\LoginController;
use App\Http\Controllers\Api\Auth\LogoutController;
use App\Http\Controllers\Api\Auth\RegisterController;
use App\Http\Controllers\Api\Auth\ResetPasswordController;
use App\Http\Controllers\Api\Auth\TwoFactorController;
use App\Http\Controllers\Api\BilanController;
use App\Http\Controllers\Api\CategoryController;
use App\Http\Controllers\Api\ClientController;
use App\Http\Controllers\Api\CommercialController;
use App\Http\Controllers\Api\CommercialReportController;
use App\Http\Controllers\Api\DepartmentController;
use App\Http\Controllers\Api\ExportController;
use App\Http\Controllers\Api\InvoiceController;
use App\Http\Controllers\Api\PermissionController;
use App\Http\Controllers\Api\ProfileController;
use App\Http\Controllers\Api\PromotionController;
use App\Http\Controllers\Api\ProspectController;
use App\Http\Controllers\Api\RoleController;
use App\Http\Controllers\Api\ServiceController;
use App\Http\Controllers\Api\SettingController;
use App\Http\Controllers\Api\StatsController;
use App\Http\Controllers\Api\SubscriptionController;
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

Route::middleware(['auth:sanctum', 'single.session', 'inactivity.logout', 'update.activity'])->group(function () {
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

    Route::get('/prospects', [ProspectController::class, 'index'])->middleware('permission:prospects.consulter');
    Route::post('/prospects', [ProspectController::class, 'store'])->middleware('permission:prospects.creer');
    Route::get('/prospects/{prospect}', [ProspectController::class, 'show'])->middleware('permission:prospects.consulter');
    Route::put('/prospects/{prospect}', [ProspectController::class, 'update'])->middleware('permission:prospects.modifier');
    Route::delete('/prospects/{prospect}', [ProspectController::class, 'destroy'])->middleware('permission:prospects.supprimer');
    Route::post('/prospects/{prospect}/convert', [ProspectController::class, 'convert'])->middleware('permission:prospects.modifier');

    Route::get('/commercials/search', [CommercialController::class, 'search'])->middleware('permission:commercials.consulter');
    Route::get('/commercials/available-users', [CommercialController::class, 'availableUsers'])->middleware('permission:commercials.consulter');
    Route::get('/commercials/ranking', [CommercialController::class, 'ranking'])->middleware('permission:commercials.consulter');
    Route::get('/commercials/report', [CommercialReportController::class, 'report'])->middleware('permission:commercials.reporting');
    Route::get('/commercials/{commercial}/stats', [CommercialController::class, 'stats'])->middleware('permission:commercials.consulter');
    Route::post('/commercials/{commercial}/points', [CommercialController::class, 'adjustPoints'])->middleware('permission:commercials.modifier');
    Route::get('/commercials', [CommercialController::class, 'index'])->middleware('permission:commercials.consulter');
    Route::post('/commercials', [CommercialController::class, 'store'])->middleware('permission:commercials.creer');
    Route::get('/commercials/{commercial}', [CommercialController::class, 'show'])->middleware('permission:commercials.consulter');
    Route::put('/commercials/{commercial}', [CommercialController::class, 'update'])->middleware('permission:commercials.modifier');
    Route::delete('/commercials/{commercial}', [CommercialController::class, 'destroy'])->middleware('permission:commercials.supprimer');

    Route::get('/employees/search', [CommercialController::class, 'search'])->middleware('permission:employes.consulter');
    Route::get('/employees/available-users', [CommercialController::class, 'availableUsers'])->middleware('permission:employes.consulter');
    Route::get('/employees/ranking', [CommercialController::class, 'ranking'])->middleware('permission:employes.consulter');
    Route::get('/employees/{commercial}/stats', [CommercialController::class, 'stats'])->middleware('permission:employes.consulter');
    Route::post('/employees/{commercial}/points', [CommercialController::class, 'adjustPoints'])->middleware('permission:employes.modifier');
    Route::get('/employees', [CommercialController::class, 'index'])->middleware('permission:employes.consulter');
    Route::post('/employees', [CommercialController::class, 'store'])->middleware('permission:employes.creer');
    Route::get('/employees/{commercial}', [CommercialController::class, 'show'])->middleware('permission:employes.consulter');
    Route::put('/employees/{commercial}', [CommercialController::class, 'update'])->middleware('permission:employes.modifier');
    Route::delete('/employees/{commercial}', [CommercialController::class, 'destroy'])->middleware('permission:employes.supprimer');

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

    Route::get('/exports/agencies', [ExportController::class, 'agencies'])->middleware('permission:agencies.exporter');
    Route::get('/exports/users', [ExportController::class, 'users'])->middleware('permission:users.exporter');
    Route::get('/exports/services', [ExportController::class, 'services'])->middleware('permission:services.exporter');
    Route::get('/exports/clients', [ExportController::class, 'clients'])->middleware('permission:clients.exporter');
    Route::get('/exports/commercials', [ExportController::class, 'commercials'])->middleware('permission:commercials.exporter');
    Route::get('/exports/employees', [ExportController::class, 'employees'])->middleware('permission:employes.exporter');
    Route::get('/exports/invoices', [ExportController::class, 'invoices'])->middleware('permission:invoices.exporter');
    Route::get('/exports/activity-logs', [ExportController::class, 'activityLogs'])->middleware('permission:activity-logs.exporter');
    Route::get('/exports/accounting', [ExportController::class, 'accounting'])->middleware('permission:comptabilite.exporter');
    Route::get('/exports/bilans', [ExportController::class, 'dailyBilan'])->middleware('permission:bilans.exporter');
    Route::get('/exports/commercial-report', [ExportController::class, 'commercialReport'])->middleware('permission:commercials.reporting');

    Route::get('/accounting/transactions', [AccountingController::class, 'index'])->middleware('permission:comptabilite.consulter');
    Route::post('/accounting/transactions', [AccountingController::class, 'store'])->middleware('permission:comptabilite.creer');
    Route::put('/accounting/transactions/{transaction}', [AccountingController::class, 'update'])->middleware('permission:comptabilite.modifier');
    Route::delete('/accounting/transactions/{transaction}', [AccountingController::class, 'destroy'])->middleware('permission:comptabilite.supprimer');

    Route::get('/accounting/categories', [AccountingCategoryController::class, 'index'])->middleware('permission:accounting-categories.consulter');
    Route::post('/accounting/categories', [AccountingCategoryController::class, 'store'])->middleware('permission:accounting-categories.creer');
    Route::put('/accounting/categories/{category}', [AccountingCategoryController::class, 'update'])->middleware('permission:accounting-categories.modifier');
    Route::delete('/accounting/categories/{category}', [AccountingCategoryController::class, 'destroy'])->middleware('permission:accounting-categories.supprimer');

    Route::get('/activity-logs', [ActivityLogController::class, 'index'])->middleware('permission:activity-logs.consulter');

    Route::get('/settings', [SettingController::class, 'index'])->middleware('permission:settings.modifier');
    Route::put('/settings', [SettingController::class, 'update'])->middleware('permission:settings.modifier');

    Route::get('/stats/overview', [StatsController::class, 'overview'])->middleware('permission:stats.consulter');
    Route::get('/stats/dashboard', [StatsController::class, 'overview'])->middleware('permission:stats.consulter');
    Route::get('/stats/agency/{agency}', [StatsController::class, 'agency'])->middleware('permission:stats.consulter');
    Route::get('/stats/monthly-revenue', [StatsController::class, 'monthlyRevenue'])->middleware('permission:stats.consulter');
    Route::get('/stats/top-commercials', [StatsController::class, 'topCommercials'])->middleware('permission:stats.consulter');
    Route::get('/stats/sales-by-category', [StatsController::class, 'salesByCategory'])->middleware('permission:stats.consulter');
    Route::get('/stats/payment-methods', [StatsController::class, 'paymentMethods'])->middleware('permission:stats.consulter');

    Route::get('/bilans/period', [BilanController::class, 'period'])->middleware('permission:bilans.consulter');
    Route::get('/bilans', [BilanController::class, 'dailyBilan'])->middleware('permission:bilans.consulter');

    Route::get('/subscription-packs', [SubscriptionController::class, 'packsIndex'])->middleware('permission:abonnements.consulter');
    Route::post('/subscription-packs', [SubscriptionController::class, 'packsStore'])->middleware('permission:abonnements.creer');
    Route::put('/subscription-packs/{pack}', [SubscriptionController::class, 'packsUpdate'])->middleware('permission:abonnements.modifier');
    Route::delete('/subscription-packs/{pack}', [SubscriptionController::class, 'packsDestroy'])->middleware('permission:abonnements.supprimer');

    Route::get('/subscriptions', [SubscriptionController::class, 'index'])->middleware('permission:abonnements.consulter');
    Route::post('/subscriptions', [SubscriptionController::class, 'store'])->middleware('permission:abonnements.creer');
    Route::get('/subscriptions/{subscription}', [SubscriptionController::class, 'show'])->middleware('permission:abonnements.consulter');
    Route::delete('/subscriptions/{subscription}', [SubscriptionController::class, 'destroy'])->middleware('permission:abonnements.supprimer');
    Route::post('/subscriptions/{subscription}/renew', [SubscriptionController::class, 'renew'])->middleware('permission:abonnements.renouveler');

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
