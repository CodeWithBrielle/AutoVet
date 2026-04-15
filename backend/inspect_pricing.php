<?php
require __DIR__ . '/vendor/autoload.php';
$app = require_once __DIR__ . '/bootstrap/app.php';
$app->make(Illuminate\Contracts\Console\Kernel::class)->bootstrap();

use App\Models\Service;
use App\Models\WeightRange;

$service = Service::where('name', 'like', '%5 in 1%')->first();
if ($service) {
    echo "Service: {$service->name}\n";
    echo "Pricing Type: {$service->pricing_type}\n";
    echo "Professional Fee: {$service->professional_fee}\n";
    $rules = $service->pricingRules()->get();
    echo "Rules Count: " . $rules->count() . "\n";
    foreach ($rules as $rule) {
        echo " - Rule Basis: {$rule->basis_type}, Ref ID: {$rule->reference_id}, Price: {$rule->price}\n";
    }
} else {
    echo "Service not found.\n";
}

$ranges = WeightRange::all();
echo "\nWeight Ranges Count: " . $ranges->count() . "\n";
foreach ($ranges as $r) {
    echo " - Range ID: {$r->id}, Species: {$r->species_id}, Min: {$r->min_weight}, Max: {$r->max_weight}, Size Cat: {$r->size_category_id}\n";
}
