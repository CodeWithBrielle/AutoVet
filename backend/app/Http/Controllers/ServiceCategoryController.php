<?php

namespace App\Http\Controllers;

use App\Models\ServiceCategory;
use Illuminate\Http\Request;

class ServiceCategoryController extends Controller
{
    public function index()
    {
        return response()->json(ServiceCategory::all());
    }

    public function store(Request $request)
    {
        $validated = $request->validate([
            'name' => 'required|string|unique:service_categories,name',
            'description' => 'nullable|string',
            'type' => 'nullable|string',
            'status' => 'required|in:Active,Inactive',
        ]);

        $category = ServiceCategory::create($validated);
        return response()->json($category, 201);
    }

    public function show(ServiceCategory $serviceCategory)
    {
        return response()->json($serviceCategory);
    }

    public function update(Request $request, ServiceCategory $serviceCategory)
    {
        $validated = $request->validate([
            'name' => 'required|string|unique:service_categories,name,' . $serviceCategory->id,
            'description' => 'nullable|string',
            'type' => 'nullable|string',
            'status' => 'required|in:Active,Inactive',
        ]);

        $serviceCategory->update($validated);
        return response()->json($serviceCategory);
    }

    public function destroy(ServiceCategory $serviceCategory)
    {
        if ($serviceCategory->services()->exists()) {
            return response()->json(['message' => 'Category is in use and cannot be deleted.'], 400);
        }
        $serviceCategory->delete();
        return response()->json(null, 204);
    }
}
