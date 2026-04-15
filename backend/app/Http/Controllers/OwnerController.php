<?php

namespace App\Http\Controllers;

use App\Models\Owner;
use Illuminate\Http\Request;
use App\Traits\NormalizesData;
use App\Traits\StandardizesResponses;

class OwnerController extends Controller
{
    use NormalizesData, StandardizesResponses;

    public function import(Request $request)
    {
        $request->validate([
            'file' => 'required|file|mimes:csv,txt',
        ]);

        $file = $request->file('file');
        $handle = fopen($file->getRealPath(), 'r');

        // Skip header
        $header = fgetcsv($handle);

        $count = 0;
        $errors = [];
        $row = 1;

        while (($data = fgetcsv($handle)) !== FALSE) {
            $row++;
            if (count($data) < 2) continue; // Skip empty rows

            // Expected format: name,phone,email,address,city,province,zip
            $ownerData = [
                'name' => $data[0] ?? null,
                'phone' => $data[1] ?? null,
                'email' => $data[2] ?? null,
                'address' => $data[3] ?? null,
                'city' => $data[4] ?? null,
                'province' => $data[5] ?? null,
                'zip' => $data[6] ?? null,
            ];

            $validator = Validator::make($ownerData, [
                'name' => 'required|string|max:255',
                'phone' => 'required|string',
                'city' => 'required|string|max:255',
                'province' => 'required|string|max:255',
                'zip' => 'required|numeric|digits:4',
            ]);

            if ($validator->fails()) {
                $errors[] = "Row {$row}: " . implode(", ", $validator->errors()->all());
                continue;
            }

            // Normalize phone number
            $ownerData['phone'] = $this->normalizePhone($ownerData['phone']);

            Owner::updateOrCreate(
                ['phone' => $ownerData['phone']],
                [
                    'name' => $ownerData['name'],
                    'email' => $ownerData['email'],
                    'address' => $ownerData['address'],
                    'city' => $ownerData['city'],
                    'province' => $ownerData['province'],
                    'zip' => $ownerData['zip'],
                ]
            );

            $count++;
        }

        fclose($handle);

        return response()->json([
            'success' => true,
            'count' => $count,
            'errors' => $errors
        ]);
    }


    public function index()
    {
        return response()->json(Owner::with('pets')->orderBy('created_at', 'desc')->get());
    }

    /**
     * Store a newly created resource in storage.
     */
    public function store(Request $request)
    {
        $validated = $request->validate([
            'name' => 'required|string|max:255',
            'phone' => 'required|string',
            'email' => 'nullable|email|max:255',
            'address' => 'nullable|string|max:255',
            'city' => 'required|string|max:255',
            'province' => 'required|string|max:255',
            'zip' => 'required|numeric|digits:4',
        ], [
            'phone.required' => 'Phone number is required.',
        ]);

        $normalizedPhone = $this->normalizePhone($validated['phone']);
        $normalizedEmail = $this->normalizeEmail($validated['email'] ?? null);

        // 1. Check for phone duplicate (Standardized manual defense)
        $existingByPhone = Owner::where('phone', $normalizedPhone)->first();
        if ($existingByPhone) {
            return $this->errorResponse(
                'DUPLICATE_ENTRY',
                'phone',
                'An owner with this phone number already exists.',
                ['phone' => ['This phone number is already registered.']],
                422,
                $existingByPhone->load('pets')
            );
        }

        // 2. Check for email duplicate (Standardized manual defense)
        if ($normalizedEmail) {
            $existingByEmail = Owner::where('email', $normalizedEmail)->first();
            if ($existingByEmail) {
                return $this->errorResponse(
                    'DUPLICATE_ENTRY',
                    'email',
                    'An owner with this email already exists.',
                    ['email' => ['This email address is already registered.']],
                    422,
                    $existingByEmail->load('pets')
                );
            }
        }

        // Apply Precision Normalization & Sanitization
        $validated['phone'] = $normalizedPhone;
        $validated['email'] = $normalizedEmail;
        $validated['city'] = $this->sanitizeLabel($validated['city']);
        $validated['province'] = $this->sanitizeLabel($validated['province']);
        // Note: Name is also title-cased for consistency
        $validated['name'] = $this->sanitizeLabel($validated['name']);

        try {
            $owner = Owner::create($validated);
            return $this->successResponse($owner, 'Owner registered successfully.', 201);
        } catch (\Illuminate\Database\QueryException $e) {
            // Database-level safety net
            if ($e->getCode() === '23000' || str_contains($e->getMessage(), '1062')) {
                $conflictSource = str_contains($e->getMessage(), 'active_phone') ? 'phone' : (str_contains($e->getMessage(), 'active_email') ? 'email' : 'phone');
                $existing = ($conflictSource === 'phone') ? Owner::where('phone', $normalizedPhone)->first() : Owner::where('email', $normalizedEmail)->first();
                
                return $this->errorResponse(
                    'DUPLICATE_ENTRY',
                    $conflictSource,
                    'A database conflict occurred during registration.',
                    [$conflictSource => ['Duplicate entry detected at database level.']],
                    422,
                    $existing ? $existing->load('pets') : null
                );
            }
            throw $e;
        }
    }

    public function show(Owner $owner)
    {
        return response()->json($owner->load('pets.species', 'pets.breed'));
    }

    public function update(Request $request, Owner $owner)
    {
        $validated = $request->validate([
            'name' => 'required|string|max:255',
            'phone' => 'required|string',
            'email' => 'nullable|email|max:255',
            'address' => 'nullable|string|max:255',
            'city' => 'required|string|max:255',
            'province' => 'required|string|max:255',
            'zip' => 'required|numeric|digits:4',
        ], [
            'phone.required' => 'Phone number is required.',
        ]);

        $normalizedPhone = $this->normalizePhone($validated['phone']);
        $normalizedEmail = $this->normalizeEmail($validated['email'] ?? null);

        // Check for duplicate phone (excluding self)
        $existingPhone = Owner::where('phone', $normalizedPhone)->where('id', '!=', $owner->id)->first();
        if ($existingPhone) {
            return $this->errorResponse(
                'DUPLICATE_ENTRY',
                'phone',
                'Another owner with this phone number already exists.',
                ['phone' => ['This phone number is already registered to another owner.']],
                422,
                $existingPhone->load('pets')
            );
        }

        // Check for duplicate email (excluding self)
        if ($normalizedEmail) {
            $existingEmail = Owner::where('email', $normalizedEmail)->where('id', '!=', $owner->id)->first();
            if ($existingEmail) {
                return $this->errorResponse(
                    'DUPLICATE_ENTRY',
                    'email',
                    'Another owner with this email already exists.',
                    ['email' => ['This email address is already registered to another owner.']],
                    422,
                    $existingEmail->load('pets')
                );
            }
        }

        $validated['phone'] = $normalizedPhone;
        $validated['email'] = $normalizedEmail;
        $validated['city'] = $this->sanitizeLabel($validated['city']);
        $validated['province'] = $this->sanitizeLabel($validated['province']);
        $validated['name'] = $this->sanitizeLabel($validated['name']);

        try {
            $owner->update($validated);
            return $this->successResponse($owner, 'Owner profile updated.');
        } catch (\Illuminate\Database\QueryException $e) {
            if ($e->getCode() === '23000' || str_contains($e->getMessage(), '1062')) {
                $conflictSource = str_contains($e->getMessage(), 'active_phone') ? 'phone' : (str_contains($e->getMessage(), 'active_email') ? 'email' : 'phone');
                return $this->errorResponse(
                    'DUPLICATE_ENTRY',
                    $conflictSource,
                    'Update failed due to a duplicate entry in the database.',
                    [$conflictSource => ['Uniqueness violation at database level.']]
                );
            }
            throw $e;
        }
    }

    public function lookup(Request $request)
    {
        $phone = $request->query('phone');
        $email = $request->query('email');

        if (!$phone && !$email) {
            return response()->json(['message' => 'No search term provided'], 400);
        }

        $query = Owner::query();

        if ($phone) {
            $normalizedPhone = $this->normalizePhone($phone);
            $query->where('phone', $normalizedPhone);
        }

        if ($email) {
            $normalizedEmail = $this->normalizeEmail($email);
            $query->orWhere('email', $normalizedEmail);
        }

        $owner = $query->with('pets')->first();

        return response()->json([
            'found' => (bool)$owner,
            'owner' => $owner
        ]);
    }

    public function destroy(Owner $owner)
    {
        // Guard against orphaning pets
        if ($owner->pets()->exists()) {
            return $this->errorResponse(
                'RESTRICTED_DELETION',
                'relationship',
                'This owner cannot be deleted because they have active pets registered in the system.',
                ['pets' => ['Owner has associated pet records.']],
                403
            );
        }

        try {
            $owner->delete();
            return $this->successResponse(null, 'Owner record archived.', 200);
        } catch (\Illuminate\Database\QueryException $e) {
            // Handle restricted deletion if owner has active pets/records
            if ($e->getCode() === '23000' || str_contains($e->getMessage(), '1451')) {
                return $this->errorResponse(
                    'RESTRICTED_DELETION',
                    'relationship',
                    'This owner cannot be deleted because they have active pets or historical medical/billing records attached to them.',
                    ['pets' => ['Record is currently referenced by other modules.']],
                    403
                );
            }
            throw $e;
        }
    }
}
