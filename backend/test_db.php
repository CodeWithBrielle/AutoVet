<?php
require __DIR__.'/vendor/autoload.php';
$app = require_once __DIR__.'/bootstrap/app.php';
$kernel = $app->make(Illuminate\Contracts\Console\Kernel::class);
$kernel->bootstrap();

try {
    echo "DB Connection: " . DB::getDefaultConnection() . "\n";
    echo "DB Database: " . DB::connection()->getDatabaseName() . "\n";
    DB::connection()->getPdo();
    echo "Connected successfully!\n";
} catch (\Exception $e) {
    echo "Error: " . $e->getMessage() . "\n";
}
