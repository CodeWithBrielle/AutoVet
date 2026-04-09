<?php

namespace App\Http\Controllers;

use Illuminate\Http\Request;

class ServiceController extends Controller
{
    public function index()
    {
        return response()->json(\App\Models\Service::with(['sizePrices', 'pricingRules', 'consumables.inventory'])->get());
    }

    public function store(Request $request)
    {
        $validated = $request->validate([
            'name' => 'required|string|max:255',
            'description' => 'nullable|string',
            'price' => 'nullable|numeric|min:0',
            'pricing_type' => 'required|string|in:fixed,size_based,weight_based,custom_based',
            'measurement_basis' => 'required|string|in:none,size,weight',
            'professional_fee' => 'nullable|numeric|min:0',
            'category' => 'nullable|string|max:255',
            'status' => 'nullable|string|in:Active,Inactive',
            'show_on_invoice' => 'nullable|boolean',
            'auto_load_linked_items' => 'nullable|boolean',
            'allow_manual_item_override' => 'nullable|boolean',
            'pricing_rules' => 'nullable|array',
            'pricing_rules.*.basis_type' => 'required|string|in:size,weight',
            'pricing_rules.*.reference_id' => 'required|integer',
            'pricing_rules.*.price' => 'required|numeric|min:0',
            'linked_items' => [
                'nullable',
                'array',
                function ($attribute, $value, $fail) use ($request) {
                    $eligibleCategories = [
                        "Vaccination", "Grooming", "Medicine", "Preventive Care", 
                        "Consultation", "Surgery", "Diagnostic", "Laboratory", "Anesthesia", "Other"
                    ];
                    if (!empty($value) && !in_array($request->input('category'), $eligibleCategories)) {
                        $fail('Linked inventory items are only allowed for categories: ' . implode(', ', $eligibleCategories) . '.');
                    }
                },
            ],
            'linked_items.*.inventory_id' => 'required|integer|exists:inventories,id',
            'linked_items.*.quantity' => 'required|numeric|min:0.01',
            'linked_items.*.is_billable' => 'required|boolean',
            'linked_items.*.is_required' => 'required|boolean',
            'linked_items.*.auto_deduct' => 'required|boolean',
            'linked_items.*.notes' => 'nullable|string',
        ]);

        $service = \App\Models\Service::create($validated);

        if (!empty($validated['pricing_rules'])) {
            $service->pricingRules()->createMany($validated['pricing_rules']);
        }
        if (!empty($validated['linked_items'])) {
            $service->consumables()->createMany($validated['linked_items']);
        }

        return response()->json($service->load(['pricingRules', 'consumables.inventory']), 201);
    }

    public function show(string $id)
    {
        $service = \App\Models\Service::with(['sizePrices', 'pricingRules', 'consumables.inventory'])->findOrFail($id);
        return response()->json($service);
    }

    public function update(Request $request, string $id)
    {
        $service = \App\Models\Service::findOrFail($id);

        $validated = $request->validate([
            'name' => 'sometimes|required|string|max:255',
            'description' => 'nullable|string',
            'price' => 'nullable|numeric|min:0',
            'pricing_type' => 'nullable|string|in:fixed,size_based,weight_based,custom_based',
            'measurement_basis' => 'nullable|string|in:none,size,weight',
            'professional_fee' => 'nullable|numeric|min:0',
            'category' => 'nullable|string|max:255',
            'status' => 'nullable|string|in:Active,Inactive',
            'show_on_invoice' => 'nullable|boolean',
            'auto_load_linked_items' => 'nullable|boolean',
            'allow_manual_item_override' => 'nullable|boolean',
            'pricing_rules' => 'nullable|array',
            'pricing_rules.*.basis_type' => 'required|string|in:size,weight',
            'pricing_rules.*.reference_id' => 'required|integer',
            'pricing_rules.*.price' => 'required|numeric|min:0',
            'linked_items' => [
                'nullable',
                'array',
                function ($attribute, $value, $fail) use ($request) {
                    $eligibleCategories = [
                        "Vaccination", "Grooming", "Medicine", "Preventive Care", 
                        "Consultation", "Surgery", "Diagnostic", "Laboratory", "Anesthesia", "Other"
                    ];
                    if (!empty($value) && !in_array($request->input('category'), $eligibleCategories)) {
                        $fail('Linked inventory items are only allowed for categories: ' . implode(', ', $eligibleCategories) . '.');
                    }
                },
            ],
            'linked_items.*.inventory_id' => 'required|integer|exists:inventories,id',
            'linked_items.*.quantity' => 'required|numeric|min:0.01',
            'linked_items.*.is_billable' => 'required|boolean',
            'linked_items.*.is_required' => 'required|boolean',
            'linked_items.*.auto_deduct' => 'required|boolean',
            'linked_items.*.notes' => 'nullable|string',
        ]);

        $service->update($validated);

        if (isset($validated['pricing_rules'])) {
            $service->pricingRules()->delete();
            $service->pricingRules()->createMany($validated['pricing_rules']);
        }

        if (isset($validated['linked_items'])) {
            $service->consumables()->delete();
            $service->consumables()->createMany($validated['linked_items']);
        }

        return response()->json($service->load(['pricingRules', 'consumables.inventory']));
    }

    public function destroy(string $id)
    {
        $service = \App\Models\Service::findOrFail($id);
        $service->delete();
        return response()->json(null, 204);
    }
}
