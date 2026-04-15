<?php
require __DIR__ . '/vendor/autoload.php';
$app = require_once __DIR__ . '/bootstrap/app.php';

$app->make(Illuminate\Contracts\Console\Kernel::class)->bootstrap();

use App\Models\Inventory;
use App\Models\Species;
use App\Models\WeightRange;

echo "--- INVENTORY DATA ---\n";
$items = Inventory::all();
foreach ($items as $item) {
    echo "ID: {$item->id}, Name: {$item->item_name}, Status: '{$item->status}', Is Service Usable: " . ($item->is_service_usable ? 'Y' : 'N') . "\n";
}

echo "\n--- SPECIES & WEIGHT RANGES ---\n";
$species = Species::all();
foreach ($species as $s) {
    $count = WeightRange::where('species_id', $s->id)->count();
    echo "Species ID: {$s->id}, Name: {$s->name}, Linked Ranges: {$count}\n";
}
