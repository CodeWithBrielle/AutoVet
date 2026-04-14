<?php

namespace App\Http\Controllers;

use App\Models\Pet;
use Illuminate\Http\Request;
use App\Traits\StandardizesResponses;
use App\Traits\NormalizesData;
use App\Traits\ValidatesContext;

class PetController extends Controller
{
    use StandardizesResponses, NormalizesData, ValidatesContext;
    public function index(Request $request)
    {
        $query = Pet::with(['owner', 'species', 'breed', 'sizeCategory']);
        
        if ($request->has('owner_id')) {
            $query->where('owner_id', $request->owner_id);
        }
        
        $pets = $query->orderBy('created_at', 'desc')->get();
        return $this->successResponse($pets);
    }

    public function store(Request $request)
    {
        $validated = $request->validate([
            'owner_id' => 'required|exists:owners,id',
            'name' => 'required|string|max:255',
            'species_id' => 'nullable|exists:species,id',
            'breed_id' => 'nullable|exists:breeds,id',
            'date_of_birth' => 'nullable|date',
            'age_group' => 'nullable|string',
            'sex' => 'nullable|string',
            'color' => 'nullable|string',
            'weight' => 'required|numeric|min:0.01',
            'weight_unit' => 'nullable|string|exists:units_of_measure,abbreviation',
            'size_category_id' => 'nullable|exists:pet_size_categories,id',
            'status' => 'nullable|string',
            'allergies' => 'nullable|string',
            'medication' => 'nullable|string',
            'notes' => 'nullable|string',
            'photo' => 'nullable|string',
        ]);

        // Precision Sanitization: Only structured labels
        $validated['name'] = $this->sanitizeLabel($validated['name']);
        if (isset($validated['color'])) {
            $validated['color'] = $this->sanitizeLabel($validated['color']);
        }
        // Note: Allergies, Medication, Notes are left RAW as per clinical precision requirements

        \Illuminate\Support\Facades\DB::beginTransaction();
        try {
            $pet = Pet::create($validated);
            \Illuminate\Support\Facades\DB::commit();
            return $this->successResponse($pet->load(['owner', 'species', 'breed', 'sizeCategory']), 'Pet record created.', 201);
        } catch (\Exception $e) {
            \Illuminate\Support\Facades\DB::rollBack();
            return $this->errorResponse('SAVE_FAILED', 'pet', 'Failed to save pet record.', [$e->getMessage()], 500);
        }
    }

    public function show(Pet $pet)
    {
        return response()->json($pet->load(['owner', 'species', 'breed', 'sizeCategory', 'appointments.service', 'medicalRecords.vet', 'invoices']));
    }

    public function update(Request $request, Pet $pet)
    {
        $validated = $request->validate([
            'owner_id' => 'required|exists:owners,id',
            'name' => 'required|string|max:255',
            'species_id' => 'nullable|exists:species,id',
            'breed_id' => 'nullable|exists:breeds,id',
            'date_of_birth' => 'nullable|date',
            'age_group' => 'nullable|string',
            'sex' => 'nullable|string',
            'color' => 'nullable|string',
            'weight' => 'required|numeric|min:0.01',
            'weight_unit' => 'nullable|string|exists:units_of_measure,abbreviation',
            'size_category_id' => 'nullable|exists:pet_size_categories,id',
            'status' => 'nullable|string',
            'allergies' => 'nullable|string',
            'medication' => 'nullable|string',
            'notes' => 'nullable|string',
            'photo' => 'nullable|string',
        ]);

        if ($request->filled('photo') && preg_match('/^data:image\/(\w+);base64,/', $request->photo)) {
            $data = substr($request->photo, strpos($request->photo, ',') + 1);
            $data = base64_decode($data);
            $extension = explode('/', explode(':', substr($request->photo, 0, strpos($request->photo, ';')))[1])[1];
            $fileName = uniqid() . '.' . $extension;
            \Illuminate\Support\Facades\Storage::disk('public')->put('pets/' . $fileName, $data);
            $validated['photo'] = 'pets/' . $fileName;
        } elseif ($request->hasFile('photo')) {
            $validated['photo'] = $request->file('photo')->store('pets', 'public');
        } else {
            // Keep existing photo if a URL was sent back unchanged
            if (isset($request->photo) && !preg_match('/^data:image/', $request->photo)) {
                // It's likely the existing path, so leave it untouched
                unset($validated['photo']);
            }
        }

        // Precision Sanitization
        $validated['name'] = $this->sanitizeLabel($validated['name']);
        if (isset($validated['color'])) {
            $validated['color'] = $this->sanitizeLabel($validated['color']);
        }

        \Illuminate\Support\Facades\DB::beginTransaction();
        try {
            $pet->update($validated);
            \Illuminate\Support\Facades\DB::commit();
            return $this->successResponse($pet->load(['owner', 'species', 'breed', 'sizeCategory']), 'Pet record updated.');
        } catch (\Exception $e) {
            \Illuminate\Support\Facades\DB::rollBack();
            return $this->errorResponse('UPDATE_FAILED', 'pet', 'Failed to update pet record.', [$e->getMessage()], 500);
        }
    }

    public function destroy(Pet $pet)
    {
        if (!auth()->user()->isAdmin() && !auth()->user()->isClinical()) {
            return $this->errorResponse('UNAUTHORIZED', 'auth', 'Unauthorized. Only Admins and Veterinarians can archive pet records.', [], 403);
        }

        try {
            $pet->delete();
            return $this->successResponse(null, 'Pet record archived.');
        } catch (\Illuminate\Database\QueryException $e) {
            if ($e->getCode() === '23000' || str_contains($e->getMessage(), '1451')) {
                return $this->errorResponse(
                    'RESTRICTED_DELETION',
                    'relationship',
                    'This pet record cannot be deleted because it is referenced by historical medical or billing data.',
                    ['history' => ['Pet has existing medical records or invoices.']],
                    403
                );
            }
            return $this->errorResponse('ARCHIVE_FAILED', 'pet', 'Failed to archive pet record.', [$e->getMessage()], 500);
        }
    }
}
