<?php

use Illuminate\Http\Request;
use Illuminate\Support\Facades\Route;

use App\Http\Controllers\{
    AppointmentController,
    ProfileController,
    InventoryController,
    PatientController,
    SettingController,
    InvoiceController,
    ServiceController,
    UserController,
    AuthController
};

// ---------------------
// PUBLIC ROUTES
// ---------------------
Route::post('/login', [AuthController::class, 'login']);
Route::get('/status', function () {
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
    // Auth
    Route::post('/logout', [AuthController::class, 'logout']);
    Route::get('/me', [AuthController::class, 'me']);

    // Inventory
    Route::get('/inventory', [InventoryController::class, 'index']);
    Route::post('/inventory', [InventoryController::class, 'store']);
    Route::put('/inventory/{inventory}', [InventoryController::class, 'update']);
    Route::delete('/inventory/{inventory}', [InventoryController::class, 'destroy']);

    // Patients
    Route::get('/patients', [PatientController::class, 'index']);
    Route::post('/patients', [PatientController::class, 'store']);
    Route::put('/patients/{patient}', [PatientController::class, 'update']);
    Route::delete('/patients/{patient}', [PatientController::class, 'destroy']);

    // Profile
    Route::get('/profile', [ProfileController::class, 'show']);
    Route::put('/profile', [ProfileController::class, 'update']);

    // Settings
    Route::get('/settings', [SettingController::class, 'index']);
    Route::put('/settings', [SettingController::class, 'update']);

    // API Resources
    Route::apiResource('appointments', AppointmentController::class);
    Route::apiResource('invoices', InvoiceController::class);
    Route::apiResource('services', ServiceController::class);
    Route::apiResource('users', UserController::class);
});