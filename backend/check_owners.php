<?php
require __DIR__.'/vendor/autoload.php';
$app = require_once __DIR__.'/bootstrap/app.php';
$kernel = $app->make(Illuminate\Contracts\Console\Kernel::class);
$kernel->bootstrap();

use App\Models\Owner;

$ids = [64, 67, 70];
foreach ($ids as $id) {
    $owner = Owner::withTrashed()->find($id);
    if ($owner) {
        echo "Owner ID $id: " . $owner->name . " (Deleted: " . ($owner->trashed() ? 'YES' : 'NO') . ")\n";
    } else {
        echo "Owner ID $id: MISSING\n";
    }
}
