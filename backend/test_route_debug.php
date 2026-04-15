<?php
require __DIR__.'/vendor/autoload.php';
$app = require_once __DIR__.'/bootstrap/app.php';
$kernel = $app->make(Illuminate\Contracts\Console\Kernel::class);
$kernel->bootstrap();

use App\Models\Pet;
use App\Models\User;
use Illuminate\Support\Facades\Route;
use Illuminate\Support\Facades\Auth;

$id = 39; // Deleted pet
$user = User::first(); // Use first user to bypass auth

Auth::login($user);

$request = Illuminate\Http\Request::create("/api/pets/$id", 'GET');
$request->headers->set('Accept', 'application/json');

try {
    $response = Route::dispatch($request);
    echo "Status Code: " . $response->getStatusCode() . "\n";
    echo "Content: " . $response->getContent() . "\n";
} catch (\Exception $e) {
    echo "Error: " . $e->getMessage() . "\n";
}
