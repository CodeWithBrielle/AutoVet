<?php

use Illuminate\Support\Facades\Route;

// ---------------------
// PUBLIC ROUTES (no middleware)
// ---------------------
Route::post('/signin', [\App\Http\Controllers\AuthController::class, 'login']);
Route::get('/status', function () {
    return response()->json([
        'status' => 'success',
        'message' => 'AutoVet API is running!',
        'timestamp' => now()->toIso8601String(),
    ]);
});

// ---------------------
// PROTECTED ROUTES (auth:sanctum)
// ---------------------
Route::middleware('auth:sanctum')->group(function () {

    // Auth
    Route::post('/logout', [\App\Http\Controllers\AuthController::class, 'logout']);
    Route::get('/me', [\App\Http\Controllers\AuthController::class, 'me']);

    // Inventory
    Route::get('/inventory', [\App\Http\Controllers\InventoryController::class, 'index']);
    Route::post('/inventory', [\App\Http\Controllers\InventoryController::class, 'store']);
    Route::put('/inventory/{inventory}', [\App\Http\Controllers\InventoryController::class, 'update']);
    Route::delete('/inventory/{inventory}', [\App\Http\Controllers\InventoryController::class, 'destroy']);

    // Patients
    Route::get('/patients', [\App\Http\Controllers\PatientController::class, 'index']);
    Route::post('/patients', [\App\Http\Controllers\PatientController::class, 'store']);
    Route::put('/patients/{patient}', [\App\Http\Controllers\PatientController::class, 'update']);
    Route::delete('/patients/{patient}', [\App\Http\Controllers\PatientController::class, 'destroy']);

    // Profile
    Route::get('/profile', [\App\Http\Controllers\ProfileController::class, 'show']);
    Route::put('/profile', [\App\Http\Controllers\ProfileController::class, 'update']);

    // Settings
    Route::get('/settings', [\App\Http\Controllers\SettingController::class, 'index']);
    Route::put('/settings', [\App\Http\Controllers\SettingController::class, 'update']);

    // API Resources
    Route::apiResource('users', \App\Http\Controllers\UserController::class);
    Route::apiResource('appointments', \App\Http\Controllers\AppointmentController::class);
    Route::apiResource('invoices', \App\Http\Controllers\InvoiceController::class);
    Route::apiResource('services', \App\Http\Controllers\ServiceController::class);
});