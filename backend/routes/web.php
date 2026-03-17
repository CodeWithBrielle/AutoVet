<?php

use Illuminate\Support\Facades\Route;

// Serve the SPA built by Vite
Route::get('/{any}', function () {
    return file_get_contents(public_path('index.html'));
})->where('any', '.*');
