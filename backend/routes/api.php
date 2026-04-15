<?php

use App\Http\Controllers\InventoryForecastController;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Route;
use App\Enums\Roles;


use App\Http\Controllers\AppointmentController;
use App\Http\Controllers\AppointmentStatusController;
use App\Http\Controllers\AuthController;
use App\Http\Controllers\DashboardController;
use App\Http\Controllers\InventoryController;
use App\Http\Controllers\InvoiceController;
use App\Http\Controllers\MedicalRecordController;
use App\Http\Controllers\NotificationTemplateController;
use App\Http\Controllers\PatientOwnerController;
use App\Http\Controllers\ProfileController;
use App\Http\Controllers\ServiceController;
use App\Http\Controllers\SettingController;
use App\Http\Controllers\UserController;
use App\Http\Controllers\VetScheduleController;
use App\Http\Controllers\CmsContentController;
use App\Http\Controllers\ClientNotificationController;

use App\Http\Controllers\PetSizeCategoryController;
use App\Http\Controllers\UnitOfMeasureController;
use App\Http\Controllers\SpeciesController;
use App\Http\Controllers\BreedController;
use App\Http\Controllers\WeightRangeController;
use App\Models\Owner;

// ---------------------------------------------------------------------------
// Public-facing routes (Login, Registration, etc.)
// ---------------------------------------------------------------------------

Route::post('/login',           [AuthController::class, 'login']);
Route::post('/register',        [AuthController::class, 'register']);
Route::post('/forgot-password', [AuthController::class, 'forgotPassword']);
Route::post('/reset-password',  [AuthController::class, 'resetPassword']);

// Test endpoint to check API status
Route::get('/status', function () {
    $dbStatus = 'disconnected';
    try {
        \Illuminate\Support\Facades\DB::connection()->getPdo();
        $dbStatus = 'connected';
    } catch (\Exception $e) {
        // Leave as disconnected
    }

    return response()->json([
        'status'    => 'success',
        'message'   => 'AutoVet Laravel API is up and running!',
        'database'  => $dbStatus,
        'environment' => app()->environment(),
        'timestamp' => now()->toIso8601String(),
    ]);
});

// ---------------------------------------------------------------------------
// Authenticated routes — all require a valid Sanctum token
// ---------------------------------------------------------------------------

Route::group(['middleware' => ['auth:sanctum']], function () {

    // -----------------------------------------------------------------------
    // User profile
    // -----------------------------------------------------------------------
    Route::get('/user',     function (Request $request) { return $request->user(); });
    Route::get('/vets',     [UserController::class, 'vets']);
    Route::post('/change-password', [AuthController::class, 'changePassword']);
    Route::post('/logout',          [AuthController::class, 'logout']);

    Route::get('/profile',          [ProfileController::class, 'show']);
    Route::put('/profile',          [ProfileController::class, 'update']);

    // -----------------------------------------------------------------------
    // Dashboard & Metrics
    // -----------------------------------------------------------------------
    Route::get('/dashboard/stats',                 [DashboardController::class, 'getStats']);
    Route::get('/dashboard/notifications',         [DashboardController::class, 'getNotifications']);
    Route::post('/dashboard/notifications/mark-all-read', [DashboardController::class, 'markNotificationsRead']);
    Route::post('/dashboard/notifications/{id}/dismiss', [DashboardController::class, 'dismissNotification']);
    Route::get('/dashboard/inventory-consumption', [DashboardController::class, 'getInventoryConsumption']);
    Route::get('/dashboard/sales-forecast',        [DashboardController::class, 'getSalesForecast']);
    Route::get('/dashboard/inventory-forecast',    [DashboardController::class, 'getInventoryForecast']);
    Route::get('/dashboard/appointment-forecast',  [DashboardController::class, 'getAppointmentForecast']);
    Route::get('/dashboard/patient-visit-predictions', [DashboardController::class, 'getPatientVisitPredictions']);

    // -----------------------------------------------------------------------
    // Core Modules
    // -----------------------------------------------------------------------
    Route::post('appointments/{appointment}/approve', [AppointmentStatusController::class, 'approve']);
    Route::post('appointments/{appointment}/decline', [AppointmentStatusController::class, 'decline']);
    Route::post('appointments/{appointment}/remind', [AppointmentStatusController::class, 'remind']);
    Route::apiResource('appointments',    AppointmentController::class);

    // Inventory and Specialized Forecast
    Route::get('inventory/low-stock',     [InventoryController::class, 'lowStock']);
    Route::get('inventory/{inventory}/transactions', [InventoryController::class, 'transactions']);
    Route::post('inventory/{inventory}/accept-forecast', [InventoryController::class, 'acceptForecastRecommendation']);
    Route::get('inventory/{inventory}/forecast', [\App\Http\Controllers\InventoryForecastController::class, 'forecast']);
    Route::apiResource('inventory',       InventoryController::class);

    Route::apiResource('invoices',        InvoiceController::class);
    Route::apiResource('services',        ServiceController::class);
    Route::apiResource('medical-records', MedicalRecordController::class);

    Route::apiResource('owners', PatientOwnerController::class);
    Route::apiResource('pets',            \App\Http\Controllers\PetController::class);
    Route::post('vet-schedules/bulk',    [VetScheduleController::class, 'bulkStore']);
    Route::apiResource('vet-schedules',   VetScheduleController::class);
    Route::post('owners/import',          [PatientOwnerController::class, 'import']);

    // -----------------------------------------------------------------------
    // Client Notifications
    Route::get('/client-notifications', [\App\Http\Controllers\ClientNotificationController::class, 'index']);
    Route::post('/client-notifications/send', [\App\Http\Controllers\ClientNotificationController::class, 'send']);
    Route::post('/client-notifications/{notification}/retry', [\App\Http\Controllers\ClientNotificationController::class, 'retry']);
    Route::apiResource('client-notifications/templates', \App\Http\Controllers\NotificationTemplateController::class)->names('client-notifications.templates');

    // -----------------------------------------------------------------------
    // Inventory
    // -----------------------------------------------------------------------
    Route::get('/inventory',                            [InventoryController::class, 'index']);
    Route::get('/inventory/low-stock',                  [InventoryController::class, 'lowStock']);
    Route::get('/inventory/{inventory}/transactions',   [InventoryController::class, 'transactions']);
    Route::put('/inventory/{inventory}',                [InventoryController::class, 'update']);
    Route::get('/inventory/{inventory}/forecast',       [InventoryForecastController::class, 'forecast']);
    Route::put('/inventory/{inventory}/accept-forecast-recommendation', [InventoryController::class, 'acceptForecastRecommendation'])
         ->middleware('role:' . Roles::ADMIN->value . ',' . Roles::VETERINARIAN->value . ',' . Roles::STAFF->value);

    // Inventory Write - Restricted to Clinic Management
    Route::post('/inventory', [InventoryController::class, 'store'])
         ->middleware('role:' . Roles::ADMIN->value . ',' . Roles::STAFF->value);

    Route::delete('/inventory/{inventory}', [InventoryController::class, 'destroy'])
         ->middleware('role:' . Roles::ADMIN->value);

    // -----------------------------------------------------------------------
    // Settings
    // -----------------------------------------------------------------------
    Route::get('/settings', [SettingController::class, 'index']);
    Route::put('/settings', [SettingController::class, 'update'])
         ->middleware('role:' . Roles::ADMIN->value);

    // -----------------------------------------------------------------------
    // Core Clinical & Administrative Resources
    // Restricted to Clinic Staff (Admin, Vet, Staff)
    // -----------------------------------------------------------------------
    Route::group(['middleware' => 'role:' . implode(',', Roles::all())], function () {
        Route::get('/dashboard/stats',                [DashboardController::class, 'getStats']);
        Route::get('/dashboard/notifications',        [DashboardController::class, 'getNotifications']);
        Route::get('/dashboard/sales-forecast',       [DashboardController::class, 'getSalesForecast']);
        Route::get('/dashboard/inventory-consumption',[DashboardController::class, 'getInventoryConsumption']);
        Route::get('/dashboard/inventory-forecast',   [DashboardController::class, 'getInventoryForecast']);
        Route::get('/dashboard/appointment-forecast', [DashboardController::class, 'getAppointmentForecast']);

        Route::apiResource('appointments',    AppointmentController::class);

        Route::get('invoices/resolve-breakdown', [InvoiceController::class, 'resolveBreakdown']);
        Route::apiResource('invoices',        InvoiceController::class);
        Route::apiResource('services',        ServiceController::class);
        Route::apiResource('medical-records', MedicalRecordController::class);
        Route::get('owners/lookup',    [OwnerController::class, 'lookup']);
        Route::apiResource('owners',          OwnerController::class);
        Route::apiResource('pets',            \App\Http\Controllers\PetController::class);
        Route::post('vet-schedules/bulk',    [VetScheduleController::class, 'bulkStore']);
        Route::apiResource('vet-schedules',   VetScheduleController::class);
        Route::post('owners/import',          [OwnerController::class, 'import']);
    });

    // -----------------------------------------------------------------------
    // Master Data — Read access for all authenticated users
    // -----------------------------------------------------------------------
    Route::get('/inventory-categories', [\App\Http\Controllers\InventoryCategoryController::class, 'index']);
    Route::get('/service-categories',    [\App\Http\Controllers\ServiceCategoryController::class, 'index']);

    Route::apiResource('pet-size-categories', PetSizeCategoryController::class);
    Route::apiResource('units-of-measure',    UnitOfMeasureController::class);
    Route::apiResource('species',             SpeciesController::class);
    Route::apiResource('breeds',              BreedController::class);
    Route::apiResource('weight-ranges',       WeightRangeController::class);

    // Master Data Write Access - Admin only
    Route::group(['middleware' => 'role:' . implode(',', Roles::adminRoles())], function () {
        Route::apiResource('inventory-categories', \App\Http\Controllers\InventoryCategoryController::class)->except(['index']);
        Route::apiResource('service-categories',    \App\Http\Controllers\ServiceCategoryController::class)->except(['index']);
    });

    // Settings
    Route::get('/settings',  [SettingController::class, 'index']);
    Route::post('/settings', [SettingController::class, 'update']);

    // Content Management
    Route::apiResource('cms-content', CmsContentController::class);

    // -----------------------------------------------------------------------
    // User Management — Admin only
    // -----------------------------------------------------------------------
    Route::group(['middleware' => 'role:' . Roles::ADMIN->value], function () {
        Route::apiResource('users', UserController::class);
        Route::post('/users/{user}/reset-password', [UserController::class, 'resetPassword']);
    });

    // -----------------------------------------------------------------------
    // Reporting
    // -----------------------------------------------------------------------
    Route::group(['middleware' => 'role:' . implode(',', Roles::adminRoles())], function () {
        Route::post('/cms-contents',                   [CmsContentController::class, 'store']);
        Route::put('/cms-contents/{cmsContent}',       [CmsContentController::class, 'update']);
        Route::delete('/cms-contents/{cmsContent}',    [CmsContentController::class, 'destroy']);
    });

    // -----------------------------------------------------------------------
    // Archive & Recovery Management & Audit Log
    // Restricted to Admin
    // -----------------------------------------------------------------------
    Route::group(['prefix' => 'archives', 'middleware' => 'role:' . implode(',', Roles::adminRoles())], function () {
        Route::get('/{type}', [\App\Http\Controllers\ArchiveController::class, 'index']);
        Route::post('/{type}/{id}/restore', [\App\Http\Controllers\ArchiveController::class, 'restore']);
        Route::delete('/{type}/{id}/force', [\App\Http\Controllers\ArchiveController::class, 'forceDelete']);
    });

    Route::group(['middleware' => 'role:' . implode(',', Roles::adminRoles())], function () {
        Route::get('/audit-logs', [\App\Http\Controllers\AuditLogController::class, 'index']);

        // Database Backup & Restore
        Route::get('/backups', [\App\Http\Controllers\BackupController::class, 'index']);
        Route::post('/backups', [\App\Http\Controllers\BackupController::class, 'create']);
        Route::post('/backups/restore', [\App\Http\Controllers\BackupController::class, 'restore']);
        Route::delete('/backups/{filename}', [\App\Http\Controllers\BackupController::class, 'destroy']);
        Route::get('/backups/download/{filename}', [\App\Http\Controllers\BackupController::class, 'download']);
    });

    // -----------------------------------------------------------------------
    // Specialized Reports — restricted to Admin only
    // -----------------------------------------------------------------------
    $reportRoles = Roles::adminRoles();
    Route::group(['prefix' => 'reports', 'middleware' => 'role:' . implode(',', $reportRoles)], function () {
        Route::get('/inventory/low-stock',            [\App\Http\Controllers\LowStockReportController::class, 'generate']);
        Route::get('/sales/revenue-summary',          [\App\Http\Controllers\SalesReportController::class, 'getRevenueSummary']);
        Route::get('/sales/top-services',             [\App\Http\Controllers\SalesReportController::class, 'getTopServices']);
        Route::get('/sales/transaction-volume',       [\App\Http\Controllers\SalesReportController::class, 'getTransactionVolume']);
        Route::get('/pets/species-distribution',      [\App\Http\Controllers\PetReportController::class, 'getSpeciesDistribution']);
        Route::get('/pets/registration-trends',       [\App\Http\Controllers\PetReportController::class, 'getRegistrationTrends']);
        Route::get('/pets/demographics',              [\App\Http\Controllers\PetReportController::class, 'getDemographics']);

        // Inventory Analytics
        Route::get('/inventory/summary',              [\App\Http\Controllers\InventoryAnalyticsController::class, 'getSummary']);
        Route::get('/inventory/top-moving',           [\App\Http\Controllers\InventoryAnalyticsController::class, 'getTopMoving']);
        Route::get('/inventory/recent-movements',     [\App\Http\Controllers\InventoryAnalyticsController::class, 'getRecentMovements']);
        Route::get('/inventory/expiring-soon',        [\App\Http\Controllers\InventoryAnalyticsController::class, 'getExpiringSoon']);
    });
});

// ---------------------------------------------------------------------------
// Integrity & Verification Routes (Local Environment Only)
// Gated inside controller via App::environment('local')
// ---------------------------------------------------------------------------
Route::group(['prefix' => 'test/integrity'], function () {
    Route::get('/rollback', [\App\Http\Controllers\IntegrityTestController::class, 'testRollback']);
    Route::get('/collision', [\App\Http\Controllers\IntegrityTestController::class, 'testCollision']);
});
