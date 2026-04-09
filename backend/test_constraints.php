<?php
require 'vendor/autoload.php';
$app = require_once 'bootstrap/app.php';
$kernel = $app->make(Illuminate\Contracts\Console\Kernel::class);
$kernel->bootstrap();

use Illuminate\Support\Facades\DB;

try {
    DB::statement('ALTER TABLE invoices ADD CONSTRAINT invoices_pet_id_foreign FOREIGN KEY (pet_id) REFERENCES pets(id) ON DELETE RESTRICT');
    echo "Success!\n";
} catch (\Exception $e) {
    echo "Failed: " . $e->getMessage() . "\n";
}
