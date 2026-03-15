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
Route::post('login', [AuthController::class, 'login']);
Route::get('status', function () {
    return response()->json([
        'status' => 'success',
        'message' => 'AutoVet API is running!',
        'timestamp' => now()->toIso8601String(),
    ]);
});

// ---------------------
// PROTECTED ROUTES
// ---------------------
Route::middleware('auth:sanctum')->group(function () {

    Route::post('logout', [AuthController::class, 'logout']);
    Route::get('me', [AuthController::class, 'me']);

    Route::apiResource('inventory', InventoryController::class)->except(['edit', 'create']);
    Route::apiResource('patients', PatientController::class)->except(['edit', 'create']);
    Route::get('profile', [ProfileController::class, 'show']);
    Route::put('profile', [ProfileController::class, 'update']);
    Route::get('settings', [SettingController::class, 'index']);
    Route::put('settings', [SettingController::class, 'update']);
    Route::apiResource('users', UserController::class)->except(['edit', 'create']);
    Route::apiResource('appointments', AppointmentController::class)->except(['edit', 'create']);
    Route::apiResource('invoices', InvoiceController::class)->except(['edit', 'create']);
    Route::apiResource('services', ServiceController::class)->except(['edit', 'create']);
});