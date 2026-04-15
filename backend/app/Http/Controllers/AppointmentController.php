<?php

namespace App\Http\Controllers;

use App\Models\Appointment;
use App\Models\VetSchedule;
use App\Models\Admin;
use App\Traits\HasInternalNotifications;
use Illuminate\Http\Request;
use App\Traits\StandardizesResponses;
use App\Traits\ValidatesContext;

class AppointmentController extends Controller
{
    use HasInternalNotifications, StandardizesResponses, ValidatesContext;
    protected $clientNotificationService;

    public function __construct(
        \App\Services\ClientNotificationService $clientNotificationService
    ) {
        $this->clientNotificationService = $clientNotificationService;
    }

    public function index(Request $request)
    {
        $user = auth()->user();
        $query = Appointment::with(['pet.owner', 'service', 'vet'])->orderBy('date', 'desc');

        if (method_exists($user, 'isOwner') && $user->isOwner()) {
            $query->whereHas('pet', function ($q) use ($user) {
                $q->where('owner_id', $user->owner?->id);
            });
        } elseif ($request->has('pet_id')) {
            $query->where('pet_id', $request->pet_id);
        }

        return $this->successResponse($query->get());
    }

    public function store(Request $request)
    {
        $this->authorize('create', Appointment::class);

        $validated = $request->validate([
            'title' => 'nullable|string|max:255',
            'date' => 'required|date|after_or_equal:today',
            'time' => 'required|date_format:H:i',
            'category' => 'nullable|string|max:100',
            'notes' => 'nullable|string',
            'status' => 'nullable|string|in:pending,confirmed,in_progress,completed,cancelled,rejected',
            'vet_id' => 'required|exists:users,id',
            'pet_id' => 'required|exists:pets,id',
            'owner_id' => 'required|exists:owners,id',
            'service_id' => 'required|exists:services,id',
        ]);

        // Hierarchy Enforcement: Ensure pet belongs to owner
        if (!$this->isPetOwnedBy($validated['pet_id'], $validated['owner_id'])) {
            return $this->errorResponse(
                'HIERARCHY_MISMATCH',
                'relationship',
                'The selected pet does not belong to the selected owner.',
                ['pet_id' => ['Validation mismatch: Pet/Owner linking is incorrect.']],
                422
            );
        }

        \Illuminate\Support\Facades\DB::beginTransaction();
        try {
            // Default title to service name if not provided
        if (empty($validated['title'])) {
            $service = \App\Models\Service::find($validated['service_id']);
            $validated['title'] = $service ? $service->name : 'General Consultation';
        }

        // Validate vet schedule if vet_id is provided
        if (!empty($validated['vet_id'])) {
            $dayOfWeek = date('l', strtotime($validated['date']));
            $schedule = VetSchedule::where('user_id', $validated['vet_id'])
                            ->where('day_of_week', $dayOfWeek)
                            ->where('is_available', true)
                            ->first();

            if (!$schedule) {
                // Fetch available days to provide a better error message
                $availableDays = VetSchedule::where('user_id', $validated['vet_id'])
                                    ->where('is_available', true)
                                    ->pluck('day_of_week')
                                    ->toArray();
                
                $vetName = Admin::find($validated['vet_id'])->name ?? 'the vet';
                $message = "{$vetName} is not available on {$dayOfWeek}s.";
                if (!empty($availableDays)) {
                    $message .= " They are usually available on: " . implode(', ', $availableDays) . ".";
                }
                
                return response()->json(['message' => $message], 422);
            }

            $time = date('H:i:s', strtotime($validated['time']));
            if ($time < $schedule->start_time || $time > $schedule->end_time) {
                 return response()->json(['message' => "Selected time is outside of vet's available hours (" . date('g:i A', strtotime($schedule->start_time)) . " - " . date('g:i A', strtotime($schedule->end_time)) . ")."], 422);
            }

            if ($schedule->break_start && $schedule->break_end) {
                if ($time >= $schedule->break_start && $time <= $schedule->break_end) {
                    return response()->json(['message' => 'Selected time falls during the vet\'s break period (' . date('g:i A', strtotime($schedule->break_start)) . " - " . date('g:i A', strtotime($schedule->break_end)) . ")."], 422);
                }
            }

            // Check for double booking for this vet
            $existingVetAppointment = Appointment::where('vet_id', $validated['vet_id'])
                                                ->where('date', $validated['date'])
                                                ->where('time', $validated['time'])
                                                ->first();
            if ($existingVetAppointment) {
                return response()->json(['message' => 'This vet already has an appointment at this time.'], 422);
            }
        }

        // Check for double booking for this pet
        $existingPetAppointment = Appointment::where('pet_id', $validated['pet_id'])
                                            ->where('date', $validated['date'])
                                            ->where('time', $validated['time'])
                                            ->first();
        if ($existingPetAppointment) {
            return response()->json(['message' => 'This pet already has an appointment at this time.'], 422);
        }

        $appointment = Appointment::create($validated);

        // Create internal notification for admins
        $this->createInternalNotification(
            'AppointmentPending',
            'New Appointment Request',
            "A new appointment for {$appointment->pet->name} has been requested for " . date('M d, Y', strtotime($appointment->date)) . " at " . date('g:i A', strtotime($appointment->time)) . ".",
            ['appointment_id' => $appointment->id]
        );

        try {
            $appointment->load('pet.owner', 'service', 'vet');
            $owner = $appointment->pet->owner;
            if ($owner) {
                $variables = [
                    'date' => $appointment->date,
                    'time' => $appointment->time,
                    'appointment_date' => \Carbon\Carbon::parse($appointment->date)->format('F j, Y'),
                    'appointment_time' => \Carbon\Carbon::parse($appointment->time)->format('g:i A'),
                    'pet_name' => $appointment->pet->name ?? '',
                    'service_name' => $appointment->service->name ?? '',
                    'vet_name' => $appointment->vet->name ?? '',
                ];

                // 1. Send Email (Idempotency and Channel Mapping)
                $this->clientNotificationService->sendFromTemplate(
                    $owner, 'appointment_booked', 'email', $variables, 'automated', $appointment
                );

                // 2. Send SMS
                $this->clientNotificationService->sendFromTemplate(
                    $owner, 'appointment_booked', 'sms', $variables, 'automated', $appointment
                );
            }
        } catch (\Exception $e) {
            \Illuminate\Support\Facades\Log::warning("Failed to send automated appointment notifications: " . $e->getMessage());
        }

            \Illuminate\Support\Facades\DB::commit();
            return $this->successResponse($appointment->load(['pet.owner', 'service', 'vet']), 'Appointment created.', 201);
        } catch (\Exception $e) {
            \Illuminate\Support\Facades\DB::rollBack();
            return $this->errorResponse('SAVE_FAILED', 'appointment', 'Failed to create appointment.', [$e->getMessage()], 422);
        }
    }

    public function show(Appointment $appointment)
    {
        return response()->json($appointment->load(['pet.owner', 'service', 'vet']));
    }

    public function update(Request $request, Appointment $appointment)
    {
        $this->authorize('update', $appointment);

        $validated = $request->validate([
            'title' => 'nullable|string|max:255',
            'date' => 'required|date',
            'time' => 'required|date_format:H:i',
            'category' => 'nullable|string|max:100',
            'notes' => 'nullable|string',
            'vet_id' => 'required|exists:users,id',
            'pet_id' => 'required|exists:pets,id',
            'owner_id' => 'required|exists:owners,id',
            'service_id' => 'required|exists:services,id',
            'status' => 'nullable|string|in:pending,confirmed,in_progress,completed,cancelled,rejected',
        ]);

        // Hierarchy Enforcement: Ensure pet belongs to owner
        if (!$this->isPetOwnedBy($validated['pet_id'], $validated['owner_id'])) {
            return $this->errorResponse(
                'HIERARCHY_MISMATCH',
                'relationship',
                'The selected pet does not belong to the selected owner.',
                ['pet_id' => ['Validation mismatch: Pet/Owner linking is incorrect.']],
                422
            );
        }

        \Illuminate\Support\Facades\DB::beginTransaction();
        try {
            if (!empty($validated['vet_id'])) {
            $dayOfWeek = date('l', strtotime($validated['date']));
            $schedule = VetSchedule::where('user_id', $validated['vet_id'])
                            ->where('day_of_week', $dayOfWeek)
                            ->where('is_available', true)
                            ->first();

            if (!$schedule) {
                $availableDays = VetSchedule::where('user_id', $validated['vet_id'])
                                    ->where('is_available', true)
                                    ->pluck('day_of_week')
                                    ->toArray();
                
                $vetName = Admin::find($validated['vet_id'])->name ?? 'the vet';
                $message = "{$vetName} is not available on {$dayOfWeek}s.";
                if (!empty($availableDays)) {
                    $message .= " They are usually available on: " . implode(', ', $availableDays) . ".";
                }
                
                return response()->json(['message' => $message], 422);
            }

            $time = date('H:i:s', strtotime($validated['time']));
            if ($time < $schedule->start_time || $time > $schedule->end_time) {
                 return response()->json(['message' => "Selected time is outside of vet's available hours (" . date('g:i A', strtotime($schedule->start_time)) . " - " . date('g:i A', strtotime($schedule->end_time)) . ")."], 422);
            }

            if ($schedule->break_start && $schedule->break_end) {
                if ($time >= $schedule->break_start && $time <= $schedule->break_end) {
                    return response()->json(['message' => 'Selected time falls during the vet\'s break period (' . date('g:i A', strtotime($schedule->break_start)) . " - " . date('g:i A', strtotime($schedule->break_end)) . ")."], 422);
                }
            }

            // Check for double booking for this vet
            $existingVetAppointment = Appointment::where('vet_id', $validated['vet_id'])
                                                ->where('date', $validated['date'])
                                                ->where('time', $validated['time'])
                                                ->where('id', '!=', $appointment->id)
                                                ->first();
            if ($existingVetAppointment) {
                return response()->json(['message' => 'This vet already has an appointment at this time.'], 422);
            }
        }

        // Check for double booking for this pet
        $existingPetAppointment = Appointment::where('pet_id', $validated['pet_id'])
                                            ->where('date', $validated['date'])
                                            ->where('time', $validated['time'])
                                            ->where('id', '!=', $appointment->id)
                                            ->first();
        if ($existingPetAppointment) {
            return response()->json(['message' => 'This pet already has an appointment at this time.'], 422);
        }

        if (empty($validated['title'])) {
            $service = \App\Models\Service::find($validated['service_id']);
            $validated['title'] = $service ? $service->name : 'General Consultation';
        }

            $appointment->update(collect($validated)->except('owner_id')->toArray());

            // Notification Trigger (Status Transition Guard)
            if ($appointment->wasChanged('status')) {
                try {
                    $owner = $appointment->pet->owner;
                    if ($owner) {
                        $eventKey = null;
                        if ($appointment->status === 'confirmed') $eventKey = 'appointment_approved';
                        if ($appointment->status === 'rejected') $eventKey = 'appointment_rejected';

                        if ($eventKey) {
                            $variables = [
                                'appointment_date' => \Carbon\Carbon::parse($appointment->date)->format('F j, Y'),
                                'pet_name' => $appointment->pet->name ?? '',
                                'vet_name' => $appointment->vet->name ?? '',
                                'rejection_reason' => $appointment->notes ?? 'Administrative decision',
                            ];

                            $this->clientNotificationService->sendFromTemplate(
                                $owner, $eventKey, 'email', $variables, 'automated', $appointment
                            );
                            $this->clientNotificationService->sendFromTemplate(
                                $owner, $eventKey, 'sms', $variables, 'automated', $appointment
                            );
                        }
                    }
                } catch (\Exception $e) {
                    \Illuminate\Support\Facades\Log::warning("Failed to send status update notifications: " . $e->getMessage());
                }
            }

            \Illuminate\Support\Facades\DB::commit();
            return $this->successResponse($appointment->load(['pet.owner', 'service', 'vet']), 'Appointment updated.');
        } catch (\Exception $e) {
            \Illuminate\Support\Facades\DB::rollBack();
            return $this->errorResponse('UPDATE_FAILED', 'appointment', 'Failed to update appointment.', [$e->getMessage()], 422);
        }
    }

    public function destroy(Appointment $appointment)
    {
        $this->authorize('delete', $appointment);
        try {
            $appointment->delete();
            return $this->successResponse(null, 'Appointment cancelled/removed.');
        } catch (\Illuminate\Database\QueryException $e) {
            if ($e->getCode() === '23000' || str_contains($e->getMessage(), '1451')) {
                return $this->errorResponse(
                    'RESTRICTED_DELETION',
                    'relationship',
                    'This appointment cannot be deleted because it is already referenced by medical records or invoices.',
                    ['history' => ['Appointment has clinical dependencies.']],
                    403
                );
            }
            throw $e;
        }
    }
}
