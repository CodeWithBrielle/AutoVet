<?php
require __DIR__.'/vendor/autoload.php';
$app = require_once __DIR__.'/bootstrap/app.php';
$kernel = $app->make(Illuminate\Contracts\Console\Kernel::class);
$kernel->bootstrap();

use App\Models\Owner;

$owners = Owner::orderBy('created_at', 'desc')->get();
echo "Count Owner::get(): " . $owners->count() . "\n";
foreach ($owners as $owner) {
    echo "ID " . $owner->id . ": " . $owner->name . " (Deleted At: " . ($owner->deleted_at ?? 'NULL') . ")\n";
}

$allOwners = Owner::withTrashed()->orderBy('created_at', 'desc')->get();
echo "\nCount Owner::withTrashed()->get(): " . $allOwners->count() . "\n";
foreach ($allOwners as $owner) {
    echo "ID " . $owner->id . ": " . $owner->name . " (Deleted At: " . ($owner->deleted_at ?? 'NULL') . ")\n";
}
