<?php

use Illuminate\Http\Request;
use Illuminate\Support\Facades\Route;

use App\Http\Controllers\AppointmentController;
use App\Http\Controllers\ProfileController;
use App\Http\Controllers\InventoryController;
use App\Http\Controllers\PatientController;
use App\Http\Controllers\SettingController;
use App\Http\Controllers\InvoiceController;
use App\Http\Controllers\ServiceController;
use App\Http\Controllers\UserController;
use App\Http\Controllers\AuthController;

// ---------------------
// AUTH ROUTES
// ---------------------
Route::post('/login', [AuthController::class, 'login']); // public
Route::middleware('auth:sanctum')->group(function () {
    Route::post('/logout', [AuthController::class, 'logout']);
    Route::get('/me', [AuthController::class, 'me']);
});

// ---------------------
// INVENTORY
// ---------------------
Route::get('/inventory', [InventoryController::class, 'index']);
Route::post('/inventory', [InventoryController::class, 'store']);
Route::put('/inventory/{inventory}', [InventoryController::class, 'update']); // modal edit
Route::delete('/inventory/{inventory}', [InventoryController::class, 'destroy']);

// ---------------------
// PATIENTS
// ---------------------
Route::get('/patients', [PatientController::class, 'index']);
Route::post('/patients', [PatientController::class, 'store']);
Route::put('/patients/{patient}', [PatientController::class, 'update']);
Route::delete('/patients/{patient}', [PatientController::class, 'destroy']);

// ---------------------
// PROFILE
// ---------------------
Route::get('/profile', [ProfileController::class, 'show']);
Route::put('/profile', [ProfileController::class, 'update']);

// ---------------------
// SETTINGS
// ---------------------
Route::get('/settings', [SettingController::class, 'index']);
Route::put('/settings', [SettingController::class, 'update']);

// ---------------------
// API RESOURCES
// ---------------------
Route::apiResource('appointments', AppointmentController::class);
Route::apiResource('invoices', InvoiceController::class);
Route::apiResource('services', ServiceController::class);
Route::apiResource('users', UserController::class);

// ---------------------
// STATUS CHECK
// ---------------------
Route::get('/status', function () {
    return response()->json([
        'status' => 'success',
        'message' => 'AutoVet Laravel API is up and running!',
        'timestamp' => now()->toIso8601String(),
    ]);
});