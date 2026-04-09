<?php

namespace Database\Seeders;

use Illuminate\Database\Seeder;
use App\Models\PetSizeCategory;
use App\Models\UnitOfMeasure;
use App\Models\WeightRange;

class MeasurementSeeder extends Seeder
{
    /**
     * Run the database seeds.
     */
    public function run(): void
    {
        // Pet Size Categories
        $sizes = [
            ['name' => 'Extra Small', 'description' => 'Up to 2kg'],
            ['name' => 'Small', 'description' => '2.01kg to 5kg'],
            ['name' => 'Medium', 'description' => '5.01kg to 10kg'],
            ['name' => 'Large', 'description' => '10.01kg to 25kg'],
            ['name' => 'Giant', 'description' => 'Over 25kg'],
        ];

        foreach ($sizes as $size) {
            PetSizeCategory::updateOrCreate(['name' => $size['name']], $size);
        }

        // Weight Ranges
        $weightRanges = [
            ['label' => 'Extra Small', 'min_weight' => 0, 'max_weight' => 2],
            ['label' => 'Small', 'min_weight' => 2.01, 'max_weight' => 5],
            ['label' => 'Medium', 'min_weight' => 5.01, 'max_weight' => 10],
            ['label' => 'Large', 'min_weight' => 10.01, 'max_weight' => 25],
            ['label' => 'Giant', 'min_weight' => 25.01, 'max_weight' => null],
        ];

        foreach ($weightRanges as $range) {
            $category = PetSizeCategory::where('name', $range['label'])->first();
            WeightRange::updateOrCreate(
                ['label' => $range['label']],
                array_merge($range, ['size_category_id' => $category?->id, 'unit' => 'kg', 'status' => 'Active'])
            );
        }

        // Units of Measure
        $units = [
            ['name' => 'Kilogram', 'abbreviation' => 'kg'],
            ['name' => 'Pound', 'abbreviation' => 'lbs'],
        ];

        foreach ($units as $unit) {
            UnitOfMeasure::updateOrCreate(['abbreviation' => $unit['abbreviation']], $unit);
        }
    }
}
