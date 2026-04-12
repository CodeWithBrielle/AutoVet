<?php

namespace App\Http\Controllers;

use App\Models\Owner;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Validator;
use libphonenumber\PhoneNumberUtil;
use libphonenumber\PhoneNumberFormat;
use libphonenumber\NumberParseException;

class OwnerController extends Controller
{
    /**
     * Normalize phone number to +639XXXXXXXXX format.
     */
    private function normalizePhone(?string $phone): ?string
    {
        if (!$phone) return null;

        // Strip non-numeric characters except +
        $phone = preg_replace('/(?<!^)\+|[^0-9+]/', '', $phone);

        // Handle local PH format 09XXXXXXXXX -> +639XXXXXXXXX
        if (preg_match('/^09\d{9}$/', $phone)) {
            $phone = '+63' . substr($phone, 1);
        }

        $phoneUtil = PhoneNumberUtil::getInstance();
        try {
            // Parse with PH as default
            $numberProto = $phoneUtil->parse($phone, "PH");
            
            if ($phoneUtil->isValidNumber($numberProto)) {
                return $phoneUtil->format($numberProto, PhoneNumberFormat::E164);
            }
        } catch (NumberParseException $e) {
            // Log if needed
        }

        return $phone; // Return cleaned numeric string as fallback
    }

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

    public function store(Request $request)
    {
        $validated = $request->validate([
            'name' => 'required|string|max:255',
            'phone' => [
                'required',
                'string',
                function ($attribute, $value, $fail) {
                    $cleaned = preg_replace('/(?<!^)\+|[^0-9+]/', '', $value);
                    if (strlen($cleaned) < 10) {
                        $fail('The phone number is too short (min 10 digits).');
                        return;
                    }
                    
                    $phoneUtil = PhoneNumberUtil::getInstance();
                    try {
                        $tempValue = $cleaned;
                        if (preg_match('/^09\d{9}$/', $tempValue)) {
                            $tempValue = '+63' . substr($tempValue, 1);
                        }
                        $numberProto = $phoneUtil->parse($tempValue, "PH");
                        if (!$phoneUtil->isValidNumber($numberProto)) {
                            $fail('The phone number is not a valid international number.');
                        }
                    } catch (NumberParseException $e) {
                        $fail('The phone number format is invalid.');
                    }
                },
            ],
            'email' => 'nullable|email|max:255',
            'address' => 'nullable|string|max:255',
            'city' => 'required|string|max:255',
            'province' => 'required|string|max:255',
            'zip' => 'required|string|max:255',
        ], [
            'phone.required' => 'Phone number is required.',
        ]);

        $validated['phone'] = $this->normalizePhone($validated['phone']);

        // Check for duplicate after normalization
        if (Owner::where('phone', $validated['phone'])->exists()) {
            return response()->json([
                'message' => 'An owner with this phone number already exists.',
                'errors' => ['phone' => ['This phone number is already registered.']]
            ], 422);
        }

        $owner = Owner::create($validated);
        return response()->json($owner, 201);
    }

    public function show(Owner $owner)
    {
        return response()->json($owner->load('pets.species', 'pets.breed'));
    }

    public function update(Request $request, Owner $owner)
    {
        $validated = $request->validate([
            'name' => 'required|string|max:255',
            'phone' => [
                'required',
                'string',
                function ($attribute, $value, $fail) {
                    $cleaned = preg_replace('/(?<!^)\+|[^0-9+]/', '', $value);
                    if (strlen($cleaned) < 10) {
                        $fail('The phone number is too short (min 10 digits).');
                        return;
                    }

                    $phoneUtil = PhoneNumberUtil::getInstance();
                    try {
                        $tempValue = $cleaned;
                        if (preg_match('/^09\d{9}$/', $tempValue)) {
                            $tempValue = '+63' . substr($tempValue, 1);
                        }
                        $numberProto = $phoneUtil->parse($tempValue, "PH");
                        if (!$phoneUtil->isValidNumber($numberProto)) {
                            $fail('The phone number is not a valid international number.');
                        }
                    } catch (NumberParseException $e) {
                        $fail('The phone number format is invalid.');
                    }
                },
            ],
            'email' => 'nullable|email|max:255',
            'address' => 'nullable|string|max:255',
            'city' => 'required|string|max:255',
            'province' => 'required|string|max:255',
            'zip' => 'required|string|max:255',
        ], [
            'phone.required' => 'Phone number is required.',
        ]);

        $validated['phone'] = $this->normalizePhone($validated['phone']);

        // Check for duplicate after normalization (excluding current owner)
        if (Owner::where('phone', $validated['phone'])->where('id', '!=', $owner->id)->exists()) {
            return response()->json([
                'message' => 'Another owner with this phone number already exists.',
                'errors' => ['phone' => ['This phone number is already registered to another owner.']]
            ], 422);
        }

        $owner->update($validated);
        return response()->json($owner);
    }

    public function destroy(Owner $owner)
    {
        $owner->delete();
        return response()->json(null, 204);
    }
}
