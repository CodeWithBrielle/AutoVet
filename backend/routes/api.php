<?php

use Illuminate\Support\Facades\Route;
use App\Http\Controllers\AuthController;
use App\Http\Controllers\UserController;
use App\Http\Controllers\ProfileController;
use App\Http\Controllers\InventoryController;
use App\Http\Controllers\PatientController;
use App\Http\Controllers\AppointmentController;
use App\Http\Controllers\InvoiceController;
use App\Http\Controllers\SettingController;
use App\Http\Controllers\ServiceController;

// Public routes
Route::post('/login', [AuthController::class, 'login'])->name('login');
Route::post('/logout', [AuthController::class, 'logout']);

// Protected routes
Route::middleware('auth:sanctum')->group(function () {

    // Current logged-in user
    Route::get('/me', [AuthController::class, 'me']);  

    // Profile
    Route::get('/profile', [ProfileController::class, 'show']);
    Route::put('/profile', [ProfileController::class, 'update']);

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

    // Settings
    Route::put('/settings', [SettingController::class, 'update']);

    // API Resources
    Route::apiResource('appointments', AppointmentController::class);
    Route::apiResource('invoices', InvoiceController::class);
    Route::apiResource('services', ServiceController::class);
    Route::apiResource('users', UserController::class);
});

// Public status route
Route::get('/status', function () {
    return response()->json([
        'status' => 'success',
        'message' => 'AutoVet Laravel API is up and running!',
        'timestamp' => now()->toIso8601String(),
    ]);
});