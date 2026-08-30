<?php

use App\Http\Controllers\Api\AccountingCategoryController;
use App\Http\Controllers\Api\AccountingController;
use App\Http\Controllers\Api\ActivityLogController;
use App\Http\Controllers\Api\AgencyController;
use App\Http\Controllers\Api\Auth\ChangePasswordController;
use App\Http\Controllers\Api\Auth\ClientLoginController;
use App\Http\Controllers\Api\Auth\ClientLogoutController;
use App\Http\Controllers\Api\Auth\ClientMeController;
use App\Http\Controllers\Api\Auth\DeleteAccountController;
use App\Http\Controllers\Api\Auth\ForgotPasswordController;
use App\Http\Controllers\Api\Auth\LoginController;
use App\Http\Controllers\Api\Auth\LogoutController;
use App\Http\Controllers\Api\Auth\RegisterController;
use App\Http\Controllers\Api\Auth\ResetPasswordController;
use App\Http\Controllers\Api\Auth\StaffLoginController;
use App\Http\Controllers\Api\Auth\TwoFactorController;
use App\Http\Controllers\Api\BilanController;
use App\Http\Controllers\Api\CategoryController;
use App\Http\Controllers\Api\CourseCategoryController;
use App\Http\Controllers\Api\CityController;
use App\Http\Controllers\Api\ClientController;
use App\Http\Controllers\Api\CommercialController;
use App\Http\Controllers\Api\CommercialReportController;
use App\Http\Controllers\Api\CourseController;
use App\Http\Controllers\Api\CourseModuleController;
use App\Http\Controllers\Api\CountryController;
use App\Http\Controllers\Api\DashboardController;
use App\Http\Controllers\Api\DepartmentController;

use App\Http\Controllers\Api\ExportController;
use App\Http\Controllers\Api\InvoiceController;
use App\Http\Controllers\Api\PermissionController;
use App\Http\Controllers\Api\OrderController;
use App\Http\Controllers\Api\ProfileController;
use App\Http\Controllers\Api\PromotionController;
use App\Http\Controllers\Api\ProspectController;
use App\Http\Controllers\Api\ProductController;
use App\Http\Controllers\Api\ReportController;
use App\Http\Controllers\Api\RoleController;
use App\Http\Controllers\Api\ScopeController;
use App\Http\Controllers\Api\SellerProfileController;
use App\Http\Controllers\Api\ServiceController;
use App\Http\Controllers\Api\SettingController;
use App\Http\Controllers\Api\StatsController;
use App\Http\Controllers\Api\SubscriptionController;
use App\Http\Controllers\Api\SubscriptionNotificationController;
use App\Http\Controllers\Api\TrainerController;
use App\Http\Controllers\Api\TreasuryController;
use App\Http\Controllers\Api\LearnerController;
use App\Http\Controllers\Api\ExpenseController;
use App\Http\Controllers\Api\ActivityController;
use App\Http\Controllers\Api\CommissionController;
use App\Http\Controllers\Api\AttendanceController;
use App\Http\Controllers\Api\CertificateController;
use App\Http\Controllers\Api\CompanyController;
use App\Http\Controllers\Api\ContractController;
use App\Http\Controllers\Api\FormationEnrollmentController;
use App\Http\Controllers\Api\LearnerObservationController;
use App\Http\Controllers\Api\OpportunityController;
use App\Http\Controllers\Api\TrainingSessionController;
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

Route::post('/staff/login', StaffLoginController::class)->middleware('throttle:5,1');
Route::post('/client/login', ClientLoginController::class)->middleware('throttle:5,1');
Route::post('/client/register', RegisterController::class)->middleware('throttle:3,10');

Route::middleware(['auth:sanctum', 'portal:client'])->group(function () {
    Route::post('/client/logout', ClientLogoutController::class);
    Route::get('/client/me', ClientMeController::class);
});

Route::middleware(['auth:sanctum', 'single.session', 'inactivity.logout', 'update.activity', 'portal:staff'])->group(function () {
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

    Route::get('/countries', [CountryController::class, 'index'])->middleware('permission:countries.consulter');
    Route::post('/countries', [CountryController::class, 'store'])->middleware('permission:countries.creer');
    Route::get('/countries/{country}', [CountryController::class, 'show'])->middleware('permission:countries.consulter');
    Route::put('/countries/{country}', [CountryController::class, 'update'])->middleware('permission:countries.modifier');
    Route::delete('/countries/{country}', [CountryController::class, 'destroy'])->middleware('permission:countries.supprimer');

    Route::get('/cities', [CityController::class, 'index'])->middleware('permission:cities.consulter');
    Route::post('/cities', [CityController::class, 'store'])->middleware('permission:cities.creer');
    Route::get('/cities/{city}', [CityController::class, 'show'])->middleware('permission:cities.consulter');
    Route::put('/cities/{city}', [CityController::class, 'update'])->middleware('permission:cities.modifier');
    Route::delete('/cities/{city}', [CityController::class, 'destroy'])->middleware('permission:cities.supprimer');

    Route::get('/scope/context', [ScopeController::class, '__invoke']);

    Route::get('/categories/trash', [CategoryController::class, 'trash']);
    Route::post('/categories/{category}/restore', [CategoryController::class, 'restore']);
    Route::delete('/categories/{category}/force-delete', [CategoryController::class, 'forceDelete']);
    Route::apiResource('categories', CategoryController::class);

    Route::apiResource('course-categories', CourseCategoryController::class);

    Route::post('/products', [ProductController::class, 'store'])->middleware('permission:products.creer');
    Route::get('/products/trash', [ProductController::class, 'trash'])->middleware('permission:products.consulter');
    Route::get('/products/search', [ProductController::class, 'search'])->middleware('permission:products.consulter');
    Route::get('/products/{product}', [ProductController::class, 'show'])->middleware('permission:products.consulter');
    Route::put('/products/{product}', [ProductController::class, 'update'])->middleware('permission:products.modifier');
    Route::delete('/products/{product}', [ProductController::class, 'destroy'])->middleware('permission:products.supprimer');
    Route::post('/products/{product}/restore', [ProductController::class, 'restore'])->middleware('permission:products.modifier');
    Route::delete('/products/{product}/force-delete', [ProductController::class, 'forceDelete'])->middleware('permission:products.supprimer');
    Route::get('/products', [ProductController::class, 'index'])->middleware('permission:products.consulter');

    Route::post('/courses', [CourseController::class, 'store'])->middleware('permission:courses.creer');
    Route::get('/courses/trash', [CourseController::class, 'trash'])->middleware('permission:courses.consulter');
    Route::get('/courses/{course}', [CourseController::class, 'show'])->middleware('permission:courses.consulter');
    Route::put('/courses/{course}', [CourseController::class, 'update'])->middleware('permission:courses.modifier');
    Route::delete('/courses/{course}', [CourseController::class, 'destroy'])->middleware('permission:courses.supprimer');
    Route::post('/courses/{course}/restore', [CourseController::class, 'restore'])->middleware('permission:courses.modifier');
    Route::delete('/courses/{course}/force-delete', [CourseController::class, 'forceDelete'])->middleware('permission:courses.supprimer');
    Route::get('/courses', [CourseController::class, 'index'])->middleware('permission:courses.consulter');

    Route::post('/training-sessions', [TrainingSessionController::class, 'store'])->middleware('permission:sessions.creer');
    Route::get('/training-sessions/trash', [TrainingSessionController::class, 'trash'])->middleware('permission:sessions.consulter');
    Route::get('/reports/training', [TrainingSessionController::class, 'report'])->middleware('permission:sessions.consulter');
    Route::post('/trainers', [TrainerController::class, 'store'])->middleware('permission:sessions.creer');
    Route::get('/trainers/available-users', [TrainerController::class, 'availableUsers'])->middleware('permission:sessions.consulter');
    Route::post('/trainers/{trainer}/link-user', [TrainerController::class, 'linkUser'])->middleware('permission:sessions.modifier');
    Route::get('/trainers', [TrainerController::class, 'index'])->middleware('permission:sessions.consulter');
    Route::get('/trainers/{trainer}/stats', [TrainerController::class, 'stats'])->middleware('permission:sessions.consulter');
    Route::get('/trainers/{trainer}', [TrainerController::class, 'show'])->middleware('permission:sessions.consulter');
    Route::put('/trainers/{trainer}', [TrainerController::class, 'update'])->middleware('permission:sessions.modifier');
    Route::delete('/trainers/{trainer}', [TrainerController::class, 'destroy'])->middleware('permission:sessions.supprimer');
    Route::get('/learners', [LearnerController::class, 'index'])->middleware('permission:enrollments.consulter');
    Route::get('/learners/{learner}/stats', [LearnerController::class, 'stats'])->middleware('permission:enrollments.consulter');

    Route::get('/reports/subscriptions', [ReportController::class, 'subscriptions'])->middleware('permission:reports.consulter');
    Route::get('/reports/customers', [ReportController::class, 'customers'])->middleware('permission:reports.consulter');
    Route::get('/reports/comparison', [ReportController::class, 'comparison'])->middleware('permission:reports.consulter');
    Route::get('/training-sessions/{trainingSession}', [TrainingSessionController::class, 'show'])->middleware('permission:sessions.consulter');
    Route::put('/training-sessions/{trainingSession}', [TrainingSessionController::class, 'update'])->middleware('permission:sessions.modifier');
    Route::delete('/training-sessions/{trainingSession}', [TrainingSessionController::class, 'destroy'])->middleware('permission:sessions.supprimer');
    Route::post('/training-sessions/{trainingSession}/restore', [TrainingSessionController::class, 'restore'])->middleware('permission:sessions.modifier');
    Route::delete('/training-sessions/{trainingSession}/force-delete', [TrainingSessionController::class, 'forceDelete'])->middleware('permission:sessions.supprimer');
    Route::get('/training-sessions', [TrainingSessionController::class, 'index'])->middleware('permission:sessions.consulter');



    Route::get('/services/trash', [ServiceController::class, 'trash']);
    Route::get('/services/search', [ServiceController::class, 'search'])->middleware('permission:services.consulter');
    Route::post('/services/{service}/restore', [ServiceController::class, 'restore']);
    Route::delete('/services/{service}/force-delete', [ServiceController::class, 'forceDelete']);
    Route::apiResource('services', ServiceController::class);

    Route::post('/uploads', [UploadController::class, 'store']);

    Route::get('/clients/search', [ClientController::class, 'search'])->middleware('permission:clients.consulter');
    Route::get('/clients', [ClientController::class, 'index'])->middleware('permission:clients.consulter');
    Route::post('/clients', [ClientController::class, 'store'])->middleware('permission:clients.creer');
    Route::get('/clients/{client}/history', [ClientController::class, 'history'])->middleware('permission:clients.consulter');
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

    Route::post('/orders', [OrderController::class, 'store'])->middleware('permission:orders.creer');
    Route::get('/orders/{order}', [OrderController::class, 'show'])->middleware('permission:orders.consulter');
    Route::put('/orders/{order}', [OrderController::class, 'update'])->middleware('permission:orders.modifier');
    Route::delete('/orders/{order}', [OrderController::class, 'destroy'])->middleware('permission:orders.supprimer');
    Route::post('/orders/{order}/confirm', [OrderController::class, 'confirm'])->middleware('permission:orders.modifier');
    Route::post('/orders/{order}/invoice', [OrderController::class, 'invoice'])->middleware('permission:orders.modifier');
    Route::post('/orders/{order}/cancel', [OrderController::class, 'cancel'])->middleware('permission:orders.modifier');
    Route::get('/orders', [OrderController::class, 'index'])->middleware('permission:orders.consulter');

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
    Route::get('/stats/group', [StatsController::class, 'group'])->middleware('permission:stats.consulter');
    Route::get('/stats/training-group', [StatsController::class, 'trainingGroup'])->middleware('permission:stats.consulter');
    Route::get('/stats/country/{country}', [StatsController::class, 'country'])->middleware('permission:stats.consulter');
    Route::get('/dashboard', [DashboardController::class, '__invoke'])->middleware('permission:stats.consulter');
    Route::get('/stats/agency/{agency}', [StatsController::class, 'agency'])->middleware('permission:stats.consulter');
    Route::get('/stats/monthly-revenue', [StatsController::class, 'monthlyRevenue'])->middleware('permission:stats.consulter');
    Route::get('/stats/top-commercials', [StatsController::class, 'topCommercials'])->middleware('permission:stats.consulter');
    Route::get('/stats/sales-by-category', [StatsController::class, 'salesByCategory'])->middleware('permission:stats.consulter');
    Route::get('/stats/payment-methods', [StatsController::class, 'paymentMethods'])->middleware('permission:stats.consulter');
    Route::get('/stats/top-products', [StatsController::class, 'topProducts'])->middleware('permission:stats.consulter');
    Route::get('/stats/top-agencies', [StatsController::class, 'topAgencies'])->middleware('permission:stats.consulter');

    Route::get('/treasury/accounts', [TreasuryController::class, 'indexAccounts'])->middleware('permission:tresories.consulter');
    Route::get('/treasury/accounts/{account}', [TreasuryController::class, 'showAccount'])->middleware('permission:tresories.consulter');
    Route::get('/treasury/transactions', [TreasuryController::class, 'indexTransactions'])->middleware('permission:tresories.consulter');
    Route::post('/treasury/transfer', [TreasuryController::class, 'transfer'])->middleware('permission:tresories.modifier');

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
    Route::post('/subscriptions/{subscription}/cancel', [SubscriptionController::class, 'cancel'])->middleware('permission:abonnements.modifier');

    Route::get('/subscription-notifications', [SubscriptionNotificationController::class, 'index'])->middleware('permission:abonnements.consulter');
    Route::post('/subscription-notifications/{notification}/retry', [SubscriptionNotificationController::class, 'retry'])->middleware('permission:abonnements.modifier');

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

    // === Sprint 3 : Dépenses ===
    Route::get('/expenses', [ExpenseController::class, 'index'])->middleware('permission:depenses.consulter');
    Route::post('/expenses', [ExpenseController::class, 'store'])->middleware('permission:depenses.creer');
    Route::get('/expenses/{expense}', [ExpenseController::class, 'show'])->middleware('permission:depenses.consulter');
    Route::put('/expenses/{expense}', [ExpenseController::class, 'update'])->middleware('permission:depenses.modifier');
    Route::delete('/expenses/{expense}', [ExpenseController::class, 'destroy'])->middleware('permission:depenses.supprimer');
    Route::post('/expenses/{expense}/submit', [ExpenseController::class, 'submit'])->middleware('permission:depenses.modifier');
    Route::post('/expenses/{expense}/approve', [ExpenseController::class, 'approve'])->middleware('permission:depenses.valider');
    Route::post('/expenses/{expense}/reject', [ExpenseController::class, 'reject'])->middleware('permission:depenses.valider');
    Route::post('/expenses/{expense}/pay', [ExpenseController::class, 'pay'])->middleware('permission:depenses.encaisser');
    Route::post('/expenses/{expense}/close', [ExpenseController::class, 'close'])->middleware('permission:depenses.modifier');
    Route::post('/expenses/{expense}/reopen', [ExpenseController::class, 'reopen'])->middleware('permission:depenses.modifier');

    // === Sprint 3 : Commissions ===
    Route::get('/commission-rules', [CommissionController::class, 'indexRules'])->middleware('permission:commissions.consulter');
    Route::get('/commission-rules/{rule}/versions', [CommissionController::class, 'ruleVersions'])->middleware('permission:commissions.consulter');
    Route::post('/commission-rules', [CommissionController::class, 'storeRule'])->middleware('permission:commissions.creer');
    Route::put('/commission-rules/{rule}', [CommissionController::class, 'updateRule'])->middleware('permission:commissions.modifier');
    Route::delete('/commission-rules/{rule}', [CommissionController::class, 'destroyRule'])->middleware('permission:commissions.supprimer');
    Route::get('/commissions/entries', [CommissionController::class, 'indexEntries'])->middleware('permission:commissions.consulter');
    Route::post('/commissions/entries', [CommissionController::class, 'storeEntry'])->middleware('permission:commissions.valider');
    Route::put('/commissions/entries/{entry}', [CommissionController::class, 'updateEntry'])->middleware('permission:commissions.valider');
    Route::post('/commissions/entries/{entry}/validate', [CommissionController::class, 'validateEntry'])->middleware('permission:commissions.valider');
    Route::post('/commissions/entries/{entry}/pay', [CommissionController::class, 'payEntry'])->middleware('permission:commissions.valider');
    Route::post('/commissions/entries/{entry}/cancel', [CommissionController::class, 'cancelEntry'])->middleware('permission:commissions.valider');
    Route::post('/commissions/seller-profiles/{sellerProfile}/recalculate', [CommissionController::class, 'recalculateSeller'])->middleware('permission:commissions.valider');
Route::get('/commission-payments/summary', [CommissionController::class, 'summary'])->middleware('permission:commissions.consulter');
Route::post('/commission-payments', [CommissionController::class, 'storePayment'])->middleware('permission:commissions.valider');

    // === Sprint 4 : CRM — Entreprises ===
    Route::get('/companies/search', [CompanyController::class, 'search'])->middleware('permission:entreprises.consulter');
    Route::get('/companies', [CompanyController::class, 'index'])->middleware('permission:entreprises.consulter');
    Route::post('/companies', [CompanyController::class, 'store'])->middleware('permission:entreprises.creer');
    Route::get('/companies/{company}', [CompanyController::class, 'show'])->middleware('permission:entreprises.consulter');
    Route::put('/companies/{company}', [CompanyController::class, 'update'])->middleware('permission:entreprises.modifier');
    Route::delete('/companies/{company}', [CompanyController::class, 'destroy'])->middleware('permission:entreprises.supprimer');

    // === Sprint 4 : CRM — Opportunités ===
    Route::get('/opportunities/pipeline', [OpportunityController::class, 'pipeline'])->middleware('permission:opportunites.consulter');
    Route::get('/opportunities', [OpportunityController::class, 'index'])->middleware('permission:opportunites.consulter');
    Route::post('/opportunities', [OpportunityController::class, 'store'])->middleware('permission:opportunites.creer');
    Route::get('/opportunities/{opportunity}', [OpportunityController::class, 'show'])->middleware('permission:opportunites.consulter');
    Route::put('/opportunities/{opportunity}', [OpportunityController::class, 'update'])->middleware('permission:opportunites.modifier');
    Route::post('/opportunities/{opportunity}/stage', [OpportunityController::class, 'changeStage'])->middleware('permission:opportunites.modifier');
    Route::delete('/opportunities/{opportunity}', [OpportunityController::class, 'destroy'])->middleware('permission:opportunites.supprimer');

    // === Sprint 4 : CRM — Activités ===
    Route::get('/crm/timeline', [ActivityController::class, 'timeline'])->middleware('permission:activites.consulter');
    Route::get('/activities', [ActivityController::class, 'index'])->middleware('permission:activites.consulter');
    Route::post('/activities', [ActivityController::class, 'store'])->middleware('permission:activites.creer');
    Route::get('/activities/{activity}', [ActivityController::class, 'show'])->middleware('permission:activites.consulter');
    Route::put('/activities/{activity}', [ActivityController::class, 'update'])->middleware('permission:activites.modifier');
    Route::post('/activities/{activity}/complete', [ActivityController::class, 'complete'])->middleware('permission:activites.modifier');
    Route::delete('/activities/{activity}', [ActivityController::class, 'destroy'])->middleware('permission:activites.supprimer');

    // === Sprint 5 : Présences ===
    Route::get('/training-sessions/{session}/attendances', [AttendanceController::class, 'index'])->middleware('permission:presences.consulter');
    Route::put('/training-sessions/{session}/attendances', [AttendanceController::class, 'bulkUpdate'])->middleware('permission:presences.modifier');

    // === Sprint 5 : Certificats ===
    Route::get('/certificates', [CertificateController::class, 'index'])->middleware('permission:certificats.consulter');
    Route::post('/certificates', [CertificateController::class, 'store'])->middleware('permission:certificats.creer');
    Route::get('/certificates/{certificate}', [CertificateController::class, 'show'])->middleware('permission:certificats.consulter');
    Route::post('/certificates/{certificate}/revoke', [CertificateController::class, 'revoke'])->middleware('permission:certificats.modifier');

    // === Sprint 5 : Contrats ===
    Route::get('/contracts', [ContractController::class, 'index'])->middleware('permission:contrats.consulter');
    Route::post('/contracts', [ContractController::class, 'store'])->middleware('permission:contrats.creer');
    Route::get('/contracts/{contract}', [ContractController::class, 'show'])->middleware('permission:contrats.consulter');
    Route::put('/contracts/{contract}', [ContractController::class, 'update'])->middleware('permission:contrats.modifier');
    Route::post('/contracts/{contract}/renew', [ContractController::class, 'renew'])->middleware('permission:contrats.modifier');
    Route::post('/contracts/{contract}/terminate', [ContractController::class, 'terminate'])->middleware('permission:contrats.supprimer');

    // === Academy — Modules de formation ===
    Route::get('/courses/{course}/modules', [CourseModuleController::class, 'index'])->middleware('permission:courses.consulter');
    Route::post('/courses/{course}/modules', [CourseModuleController::class, 'store'])->middleware('permission:courses.creer');
    Route::put('/courses/{course}/modules/reorder', [CourseModuleController::class, 'reorder'])->middleware('permission:courses.modifier');
    Route::get('/courses/{course}/modules/{module}', [CourseModuleController::class, 'show'])->middleware('permission:courses.consulter');
    Route::put('/courses/{course}/modules/{module}', [CourseModuleController::class, 'update'])->middleware('permission:courses.modifier');
    Route::delete('/courses/{course}/modules/{module}', [CourseModuleController::class, 'destroy'])->middleware('permission:courses.supprimer');

    // === Academy — Inscriptions formations ===
    Route::get('/formation-enrollments', [FormationEnrollmentController::class, 'index'])->middleware('permission:enrollments.consulter');
    Route::post('/formation-enrollments', [FormationEnrollmentController::class, 'store'])->middleware('permission:enrollments.creer');
    Route::get('/formation-enrollments/{formationEnrollment}', [FormationEnrollmentController::class, 'show'])->middleware('permission:enrollments.consulter');
    Route::put('/formation-enrollments/{formationEnrollment}', [FormationEnrollmentController::class, 'update'])->middleware('permission:enrollments.modifier');
    Route::delete('/formation-enrollments/{formationEnrollment}', [FormationEnrollmentController::class, 'destroy'])->middleware('permission:enrollments.supprimer');
    Route::get('/courses/{course}/learners', [FormationEnrollmentController::class, 'learners'])->middleware('permission:enrollments.consulter');

    // === Academy — Observations apprenants ===
    Route::get('/learner-observations', [LearnerObservationController::class, 'index'])->middleware('permission:presences.consulter');
    Route::post('/learner-observations', [LearnerObservationController::class, 'store'])->middleware('permission:presences.creer');
    Route::delete('/learner-observations/{learnerObservation}', [LearnerObservationController::class, 'destroy'])->middleware('permission:presences.supprimer');

    // === Academy — Promotions formations ===
    Route::post('/courses/{course}/promotions', [PromotionController::class, 'storeForFormation'])->middleware('permission:promotions.creer');

    // === Vendeurs & Commissions ===
    Route::get('/seller-profiles', [SellerProfileController::class, 'index'])->middleware('permission:commissions.consulter');
    Route::post('/seller-profiles', [SellerProfileController::class, 'store'])->middleware('permission:commissions.creer');
    Route::get('/seller-profiles/{sellerProfile}', [SellerProfileController::class, 'show'])->middleware('permission:commissions.consulter');
    Route::put('/seller-profiles/{sellerProfile}', [SellerProfileController::class, 'update'])->middleware('permission:commissions.modifier');
    Route::delete('/seller-profiles/{sellerProfile}', [SellerProfileController::class, 'destroy'])->middleware('permission:commissions.supprimer');
    Route::get('/seller-profiles/{sellerProfile}/commissions', [SellerProfileController::class, 'commissions'])->middleware('permission:commissions.consulter');
    Route::post('/seller-profiles/{sellerProfile}/pay', [SellerProfileController::class, 'payCommission'])->middleware('permission:commissions.valider');
});
