<?php

namespace App\Services;

use App\Models\Service;
use App\Models\Pet;
use App\Models\ServicePrice;

class PricingService
{
    /**
     * Generate a complete billing breakdown for a service.
     */
    public function generateBillingBreakdown(Service $service, ?Pet $pet = null, float $quantity = 1, ?float $weight = null): array
    {
        $professionalFee = $this->calculatePrice($service, $pet, 1, null, $weight);
        
        $serviceLine = [
            'name' => $service->name . " - Professional Fee",
            'type' => 'service',
            'line_type' => 'service',
            'reference_type' => Service::class,
            'reference_id' => $service->id,
            'qty' => $quantity,
            'unit_price' => $professionalFee,
            'total' => $professionalFee * $quantity,
            'is_billable' => true,
        ];

        $itemLines = [];
        $subtotal = $serviceLine['total'];

        // Add linked consumables/items
        if ($service->auto_load_linked_items) {
            $consumables = $service->consumables()->with('inventory')->get();
            foreach ($consumables as $consumable) {
                $unitPrice = $consumable->is_billable ? (float) ($consumable->inventory->selling_price ?? 0) : 0;
                $lineQty = $consumable->quantity * $quantity;
                $lineTotal = $unitPrice * $lineQty;

                $itemLines[] = [
                    'name' => $consumable->inventory->name ?? 'Unknown Item',
                    'type' => 'item',
                    'line_type' => 'item',
                    'reference_type' => \App\Models\Inventory::class,
                    'reference_id' => $consumable->inventory_id,
                    'qty' => $lineQty,
                    'unit_price' => $unitPrice,
                    'total' => $lineTotal,
                    'is_billable' => $consumable->is_billable,
                    'metadata' => [
                        'auto_loaded' => true,
                        'is_required' => $consumable->is_required,
                    ]
                ];

                if ($consumable->is_billable) {
                    $subtotal += $lineTotal;
                }
            }
        }

        // Tax Calculation (Fixed 12% VAT as per current system requirement)
        $taxRate = 12.00;
        $taxAmount = round($subtotal * ($taxRate / 100), 2);
        $grandTotal = $subtotal + $taxAmount;

        return [
            'professional_fee' => $professionalFee,
            'service_line' => $serviceLine,
            'item_lines' => $itemLines,
            'subtotal' => $subtotal,
            'tax_rate' => $taxRate,
            'tax_amount' => $taxAmount,
            'grand_total' => $grandTotal,
        ];
    }

    /**
     * Calculate the price for a service given a pet.
     */
    public function calculatePrice(Service $service, ?Pet $pet = null, float $quantity = 1, ?float $manualPrice = null, ?float $weight = null): float
    {
        if ($service->pricing_mode === 'manual' && $manualPrice !== null) { // Legacy check
            return $manualPrice * $quantity;
        }

        if ($service->pricing_type === 'fixed') {
            return (float) ($service->professional_fee ?? $service->price ?? 0) * $quantity;
        }

        if ($service->pricing_type === 'weight_based' && isset($pet)) {
            $petWeight = $weight ?? (float) $pet->weight;
            
            if ($petWeight === null || $petWeight <= 0) {
                throw new \Exception("Pet weight is required for weight-based service '{$service->name}'.");
            }
            
            $range = \App\Models\WeightRange::where('status', 'Active')
                ->where('species_id', $pet->species_id)
                ->where('min_weight', '<=', $petWeight)
                ->where(function ($query) use ($petWeight) {
                    $query->where('max_weight', '>=', $petWeight)
                          ->orWhereNull('max_weight');
                })
                ->first();

            if ($range && $range->size_category_id) {
                $rule = $service->pricingRules()
                    ->where('basis_type', 'size')
                    ->where('reference_id', $range->size_category_id)
                    ->first();
                
                if ($rule) {
                    return (float) $rule->price * $quantity;
                }
            }

            throw new \Exception("No pricing rule configured for weight '{$petWeight}kg' (Species: {$pet->species_id}) for service '{$service->name}'.");
        }

        // Final fallback: Use professional_fee or legacy price
        $finalPrice = ($service->professional_fee ?? $service->price ?? 0);
        return (float) $finalPrice * $quantity;
    }

    /**
     * Validate an item's price against system rules.
     */
    public function validatePrice(Service $service, float $submittedUnitPrice, ?Pet $pet = null): bool
    {
        if ($service->pricing_mode === 'manual') {
            return true;
        }

        try {
            $expectedPrice = $this->calculatePrice($service, $pet);
            // Allow for minor floating point differences if any, or strict equality
            return abs($expectedPrice - $submittedUnitPrice) < 0.01;
        } catch (\Exception $e) {
            return false;
        }
    }
}
