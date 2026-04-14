<?php
require __DIR__.'/vendor/autoload.php';
$app = require_once __DIR__.'/bootstrap/app.php';
$kernel = $app->make(Illuminate\Contracts\Console\Kernel::class);
$kernel->bootstrap();

use App\Models\Pet;

$ids = [19, 39, 40, 67, 70];
foreach ($ids as $id) {
    $pet = Pet::withTrashed()->find($id);
    if ($pet) {
        echo "ID $id: " . $pet->name . " (Deleted: " . ($pet->trashed() ? 'YES' : 'NO') . ")\n";
    } else {
        echo "ID $id: MISSING\n";
    }
}
