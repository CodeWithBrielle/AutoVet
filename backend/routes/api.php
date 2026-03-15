<?php

use Illuminate\Support\Facades\Route;
use App\Http\Controllers\{
    AuthController,
    ProfileController,
    InventoryController,
    PatientController,
    SettingController,
    AppointmentController,
    InvoiceController,
    ServiceController,
    UserController
};

// ---------------------
// PUBLIC ROUTES
// ---------------------
Route::middleware('api')->group(function () {
    Route::post('/login', [AuthController::class, 'login']);
    Route::get('/status', function () {
        return response()->json([
            'status' => 'success',
            'message' => 'AutoVet API is running!',
            'timestamp' => now()->toIso8601String(),
        ]);
    });
});

// ---------------------
// PROTECTED ROUTES
// ---------------------
Route::middleware(['api', 'auth:sanctum'])->group(function () {

    // Auth
    Route::post('/logout', [AuthController::class, 'logout']);
    Route::get('/me', [AuthController::class, 'me']);

    // Inventory
    Route::apiResource('inventory', InventoryController::class)->except(['edit', 'create']);

    // Patients
    Route::apiResource('patients', PatientController::class)->except(['edit', 'create']);

    // Profile
    Route::get('/profile', [ProfileController::class, 'show']);
    Route::put('/profile', [ProfileController::class, 'update']);

    // Settings
    Route::get('/settings', [SettingController::class, 'index']);
    Route::put('/settings', [SettingController::class, 'update']);

    // Other resources
    Route::apiResource('users', UserController::class)->except(['edit', 'create']);
    Route::apiResource('appointments', AppointmentController::class)->except(['edit', 'create']);
    Route::apiResource('invoices', InvoiceController::class)->except(['edit', 'create']);
    Route::apiResource('services', ServiceController::class)->except(['edit', 'create']);
});