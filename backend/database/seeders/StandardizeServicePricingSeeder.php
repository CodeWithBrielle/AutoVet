<?php

namespace Database\Seeders;

use Illuminate\Database\Seeder;
use App\Models\Service;
use App\Models\ServicePricingRule;
use App\Models\WeightRange;
use Illuminate\Support\Facades\DB;

class StandardizeServicePricingSeeder extends Seeder
{
    /**
     * Run the database seeds.
     */
    public function run(): void
    {
        DB::transaction(function () {
            // 1. Convert services from size_based to weight_based
            $services = Service::where('pricing_type', 'size_based')->get();
            foreach ($services as $service) {
                $service->update(['pricing_type' => 'weight_based']);
                $this->command->info("Migrated service: {$service->name} to weight_based.");
            }

            // 2. Migrate pricing rules from size to weight
            $rules = ServicePricingRule::where('basis_type', 'size')->get();
            $count = 0;
            foreach ($rules as $rule) {
                // Find weight ranges that belong to this size category
                $weightRanges = WeightRange::where('size_category_id', $rule->reference_id)->get();
                
                foreach ($weightRanges as $range) {
                    // Create new weight-based rule
                    ServicePricingRule::create([
                        'service_id' => $rule->service_id,
                        'basis_type' => 'weight',
                        'reference_id' => $range->id,
                        'price' => $rule->price
                    ]);
                    $count++;
                }
                
                // Delete the old size-based rule
                $rule->delete();
            }

            $this->command->info("Migrated {$count} pricing rules from size-based to weight-based.");
        });
    }
}
