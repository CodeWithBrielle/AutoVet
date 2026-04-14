<?php
require __DIR__.'/vendor/autoload.php';
$app = require_once __DIR__.'/bootstrap/app.php';
$kernel = $app->make(Illuminate\Contracts\Console\Kernel::class);
$kernel->bootstrap();

use App\Models\Pet;

$id = 19;
$pet = Pet::find($id);

if ($pet) {
    echo "Pet found: " . $pet->name . " (ID: $id)\n";
    echo "Deleted At: " . ($pet->deleted_at ?? 'null') . "\n";
} else {
    // Check if it's trashed
    $trashed = Pet::onlyTrashed()->find($id);
    if ($trashed) {
        echo "Pet is TRASHED (Deleted): " . $trashed->name . " (ID: $id)\n";
    } else {
        echo "Pet NOT found in database (ID: $id)\n";
    }
}

// List some pets to see what IDs exist
echo "\nSome existing IDs:\n";
print_r(Pet::limit(5)->pluck('id')->toArray());
