<?php

namespace Database\Seeders;

use Illuminate\Database\Seeder;
use App\Models\Service;
use App\Models\ServicePrice;

class ServicesSeeder extends Seeder
{
    public function run(): void
    {
        // 1. Consultation (Fixed)
        Service::updateOrCreate(
            ['name' => 'General Consultation'],
            [
                'description' => 'Standard pet health checkup',
                'price' => 500.00,
                'pricing_mode' => 'fixed',
                'category' => 'Consultation',
                'status' => 'Active'
            ]
        );

        // 2. Vaccination (Fixed)
        Service::updateOrCreate(
            ['name' => 'Vaccination'],
            [
                'description' => 'Standard vaccination shot',
                'price' => 800.00,
                'pricing_mode' => 'fixed',
                'category' => 'Medical',
                'status' => 'Active'
            ]
        );

        // 3. Grooming (Weight-based)
        $grooming = Service::updateOrCreate(
            ['name' => 'Full Grooming'],
            [
                'description' => 'Complete bath, hair cut, and nail trimming',
                'professional_fee' => 500.00,
                'pricing_type' => 'weight_based',
                'measurement_basis' => 'weight',
                'category' => 'Grooming',
                'status' => 'Active'
            ]
        );

        $sizeMapping = [
            'Extra Small' => 400.00,
            'Small' => 500.00,
            'Medium' => 700.00,
            'Large' => 900.00,
            'Giant' => 1200.00
        ];

        foreach ($sizeMapping as $sizeName => $price) {
            $size = \App\Models\PetSizeCategory::where('name', $sizeName)->first();
            if ($size) {
                \App\Models\ServicePricingRule::updateOrCreate(
                    ['service_id' => $grooming->id, 'basis_type' => 'size', 'reference_id' => $size->id],
                    ['price' => $price]
                );
            }
        }

        // 4. Medicines (Quantity-based)
        Service::updateOrCreate(
            ['name' => 'Deworming'],
            [
                'description' => 'Internal parasite treatment',
                'price' => 250.00,
                'pricing_mode' => 'fixed',
                'category' => 'Medical',
                'status' => 'Active'
            ]
        );
    }
}
