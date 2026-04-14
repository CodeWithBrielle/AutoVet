<?php
require __DIR__.'/vendor/autoload.php';
$app = require_once __DIR__.'/bootstrap/app.php';
$kernel = $app->make(Illuminate\Contracts\Console\Kernel::class);
$kernel->bootstrap();

use Illuminate\Support\Facades\Route;

$id = 19;
$request = Illuminate\Http\Request::create("/api/pets/$id", 'GET');

try {
    $response = Route::dispatch($request);
    echo "Status Code: " . $response->getStatusCode() . "\n";
    echo "Content: " . substr($response->getContent(), 0, 500) . "...\n";
} catch (\Exception $e) {
    echo "Error: " . $e->getMessage() . "\n";
}
