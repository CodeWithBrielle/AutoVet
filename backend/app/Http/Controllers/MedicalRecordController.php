<?php

namespace App\Http\Controllers;

use App\Enums\Roles;
use App\Models\MedicalRecord;
use Illuminate\Http\Request;
use App\Traits\StandardizesResponses;
use App\Traits\ValidatesContext;

/**
 * MedicalRecordController
 *
 * All role checks now use the centralized Roles enum to prevent
 * string mismatch bugs (previous code used 'vet'/'admin' which
 * didn't match the actual role values stored in the database).
 */
class MedicalRecordController extends Controller
{
    use StandardizesResponses, ValidatesContext;

    protected $clientNotificationService;

    public function __construct(
        \App\Services\ClientNotificationService $clientNotificationService
    ) {
        $this->clientNotificationService = $clientNotificationService;
    }
    public function index(Request $request)
    {
        $query = MedicalRecord::with(['pet', 'vet']);

        if ($request->has('pet_id')) {
            $query->where('pet_id', $request->pet_id);
        }

        return $this->successResponse($query->orderBy('created_at', 'desc')->get());
    }

    public function store(Request $request)
    {
        $validated = $request->validate([
            'pet_id'          => 'required|exists:pets,id',
            'appointment_id'  => 'required|exists:appointments,id',
            'vet_id'          => 'nullable|exists:users,id',
            'chief_complaint' => 'nullable|string',
            'findings'        => 'nullable|string',
            'diagnosis'       => 'nullable|string',
            'treatment_plan'  => 'nullable|string',
            'notes'           => 'nullable|string',
            'follow_up_date'  => 'nullable|date',
            'owner_id'        => 'required|exists:owners,id',
        ]);

        // Hierarchy Enforcement: Ensure Pet-Appointment-Owner chain is intact
        if (!$this->isAppointmentForPet($validated['appointment_id'], $validated['pet_id'])) {
            return $this->errorResponse(
                'HIERARCHY_MISMATCH',
                'relationship',
                'Hierarchy Mismatch: The selected pet does not match the appointment record.',
                ['pet_id' => ['Validation failed: Pet/Appointment linking mismatch.']],
                422
            );
        }

        if (!$this->isPetOwnedBy($validated['pet_id'], $validated['owner_id'])) {
            return $this->errorResponse(
                'HIERARCHY_MISMATCH',
                'relationship',
                'Hierarchy Mismatch: The selected pet does not belong to the provided owner record.',
                ['owner_id' => ['Validation failed: Owner/Pet linking mismatch.']],
                422
            );
        }

        $appt = \App\Models\Appointment::find($validated['appointment_id']);

        // Auto-assign the logged-in user as vet if they are a clinical role
        if (empty($validated['vet_id']) && auth()->check()) {
            $userRole = auth()->user()->role;
            if (in_array($userRole, Roles::clinicalRoles())) {
                $validated['vet_id'] = auth()->id();
            }
        }

        \Illuminate\Support\Facades\DB::beginTransaction();
        try {
            // Create record (excluding owner_id from mass-assignment as it's not a model field)
            $record = MedicalRecord::create(collect($validated)->except('owner_id')->toArray());
            
            // 2. Atomic Visit Update: Mark appointment as complete when treatment is recorded
            $appt->update(['status' => 'completed']);

            \Illuminate\Support\Facades\DB::commit();
            return $this->successResponse($record->load(['pet', 'vet']), 'Treatment record saved.', 201);
        } catch (\Exception $e) {
            \Illuminate\Support\Facades\DB::rollBack();
            return $this->errorResponse('SAVE_FAILED', 'clinical', 'Failed to save treatment record: Internal clinical state error.', [$e->getMessage()], 500);
        }

        // 3. Decoupled side effects: Notifications happen outside the transaction
        try {
            $record->load('pet.owner');
            $owner = $record->pet->owner;
            if ($owner) {
                $clinicName = \App\Models\Setting::where('key', 'clinic_name')->value('value') ?? 'Our Clinic';
                $this->clientNotificationService->sendFromTemplate(
                    $owner,
                    'medical_summary_notice',
                    'email',
                    [
                        'pet_name' => $record->pet->name,
                        'diagnosis' => $record->diagnosis ?: 'N/A',
                        'clinic_name' => $clinicName,
                    ],
                    'automated',
                    $record
                );
            }
        } catch (\Exception $e) {
            \Illuminate\Support\Facades\Log::warning("Failed to send automated medical record notification: " . $e->getMessage());
        }

        return response()->json([
            'success' => true,
            'data' => $record->load(['pet', 'vet']),
            'metadata' => ['processed_at' => now()]
        ], 201);
    }

    public function show(MedicalRecord $medicalRecord)
    {
        return response()->json($medicalRecord->load(['pet', 'vet']));
    }

    public function update(Request $request, MedicalRecord $medicalRecord)
    {
        $validated = $request->validate([
            'pet_id'          => 'required|exists:pets,id',
            'appointment_id'  => 'required|exists:appointments,id',
            'vet_id'          => 'nullable|exists:users,id',
            'chief_complaint' => 'nullable|string',
            'findings'        => 'nullable|string',
            'diagnosis'       => 'nullable|string',
            'treatment_plan'  => 'nullable|string',
            'notes'           => 'nullable|string',
            'follow_up_date'  => 'nullable|date',
            'owner_id'        => 'required|exists:owners,id',
        ]);

        // Hierarchy Enforcement: Ensure Pet-Appointment-Owner chain is intact
        if (!$this->isAppointmentForPet($validated['appointment_id'], $validated['pet_id'])) {
            return $this->errorResponse(
                'HIERARCHY_MISMATCH',
                'relationship',
                'Hierarchy Mismatch: The selected pet does not match the appointment record.',
                ['pet_id' => ['Validation failed: Pet/Appointment linking mismatch.']],
                422
            );
        }

        if (!$this->isPetOwnedBy($validated['pet_id'], $validated['owner_id'])) {
            return $this->errorResponse(
                'HIERARCHY_MISMATCH',
                'relationship',
                'Hierarchy Mismatch: The selected pet does not belong to the provided owner record.',
                ['owner_id' => ['Validation failed: Owner/Pet linking mismatch.']],
                422
            );
        }

        // Only clinical staff (Veterinarian) may edit diagnosis
        if ($request->has('diagnosis') && auth()->check()) {
            $userRole = auth()->user()->role;
            if (!in_array($userRole, Roles::clinicalRoles())) {
                return $this->errorResponse('UNAUTHORIZED', 'clinical', 'Unauthorized. Only veterinarians may edit column values affecting clinical diagnosis.', [], 403);
            }
        }

        $medicalRecord->update(collect($validated)->except('owner_id')->toArray());
        return $this->successResponse($medicalRecord->load(['pet', 'vet']), 'Clinical record updated.');
    }

    public function destroy(MedicalRecord $medicalRecord)
    {
        // Deletion restricted to Admin or Veterinarian
        if (auth()->check()) {
            $userRole = auth()->user()->role;
            $allowedRoles = array_merge(Roles::adminRoles(), [Roles::VETERINARIAN->value]);
            if (!in_array($userRole, $allowedRoles)) {
                return $this->errorResponse('UNAUTHORIZED', 'clinical', 'Only authorized staff can delete medical records.', [], 403);
            }
        }

        try {
            $medicalRecord->delete();
            return $this->successResponse(null, 'Clinical record removed.');
        } catch (\Illuminate\Database\QueryException $e) {
            if ($e->getCode() === '23000' || str_contains($e->getMessage(), '1451')) {
                return $this->errorResponse(
                    'RESTRICTED_DELETION',
                    'relationship',
                    'This clinical record cannot be deleted because it is referenced by other billing modules.',
                    ['history' => ['Clinical record has billing dependencies.']],
                    403
                );
            }
            throw $e;
        }
    }
}
