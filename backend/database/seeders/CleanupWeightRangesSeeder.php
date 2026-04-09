<?php

namespace Database\Seeders;

use Illuminate\Database\Seeder;
use App\Models\WeightRange;
use App\Models\ServicePricingRule;
use Illuminate\Support\Facades\DB;

class CleanupWeightRangesSeeder extends Seeder
{
    /**
     * Run the database seeds.
     */
    public function run(): void
    {
        $validLabels = ['Extra Small', 'Small', 'Medium', 'Large', 'Giant'];

        // 1. Identify and delete invalid weight ranges
        $invalidRanges = WeightRange::whereNotIn('label', $validLabels)->get();
        
        foreach ($invalidRanges as $range) {
            $this->command->info("Deleting invalid weight range: {$range->label} (ID: {$range->id})");
            
            // Optional: Clean up orphaned pricing rules first to be safe, 
            // although they aren't FK constrained, it's good practice.
            ServicePricingRule::where('basis_type', 'weight')
                ->where('reference_id', $range->id)
                ->delete();
                
            $range->delete();
        }

        // 2. Clean up any other orphaned pricing rules (where reference_id doesn't exist)
        $orphanedRules = ServicePricingRule::where('basis_type', 'weight')
            ->whereNotExists(function ($query) {
                $query->select(DB::raw(1))
                    ->from('weight_ranges')
                    ->whereRaw('weight_ranges.id = service_pricing_rules.reference_id');
            })->delete();

        if ($orphanedRules > 0) {
            $this->command->info("Deleted {$orphanedRules} orphaned weight-based pricing rules.");
        }

        $this->command->info("Weight ranges cleanup completed.");
    }
}
