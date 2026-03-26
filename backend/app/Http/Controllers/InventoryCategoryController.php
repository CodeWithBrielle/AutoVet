<?php

namespace App\Http\Controllers;

use App\Models\InventoryCategory;
use Illuminate\Http\Request;

class InventoryCategoryController extends Controller
{
    public function index()
    {
        return response()->json(InventoryCategory::all());
    }

    public function store(Request $request)
    {
        $validated = $request->validate([
            'name' => 'required|string|unique:inventory_categories,name',
            'description' => 'nullable|string',
            'status' => 'required|in:Active,Inactive',
        ]);

        $category = InventoryCategory::create($validated);
        return response()->json($category, 201);
    }

    public function show(InventoryCategory $inventoryCategory)
    {
        return response()->json($inventoryCategory);
    }

    public function update(Request $request, InventoryCategory $inventoryCategory)
    {
        $validated = $request->validate([
            'name' => 'required|string|unique:inventory_categories,name,' . $inventoryCategory->id,
            'description' => 'nullable|string',
            'status' => 'required|in:Active,Inactive',
        ]);

        $inventoryCategory->update($validated);
        return response()->json($inventoryCategory);
    }

    public function destroy(InventoryCategory $inventoryCategory)
    {
        if ($inventoryCategory->inventories()->exists()) {
            return response()->json(['message' => 'Category is in use and cannot be deleted.'], 400);
        }
        $inventoryCategory->delete();
        return response()->json(null, 204);
    }
}
