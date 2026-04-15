<?php

namespace App\Http\Controllers;

use App\Models\ClientNotification;
use App\Models\Owner;
use App\Models\NotificationTemplate;
use App\Services\ClientNotificationService;
use Illuminate\Http\Request;

class ClientNotificationController extends Controller
{
    protected ClientNotificationService $service;

    public function __construct(ClientNotificationService $service)
    {
        $this->service = $service;
    }

    public function index(Request $request)
    {
        $query = ClientNotification::with(['owner', 'related'])->latest();

        if ($request->has('owner_id')) {
            $query->where('owner_id', $request->owner_id);
        }

        if ($request->has('channel')) {
            $query->where('channel', $request->channel);
        }

        if ($request->has('status')) {
            $query->where('status', $request->status);
        }

        return response()->json($query->paginate(20));
    }

    public function send(Request $request)
    {
        $validated = $request->validate([
            'owner_id' => 'required|exists:owners,id',
            'channel' => 'required|in:email,sms',
            'template_id' => 'nullable|exists:notification_templates,id',
            'custom_message' => 'nullable|string',
            'title' => 'nullable|string', // primarily for email
            'related_type' => 'nullable|string',
            'related_id' => 'nullable|integer',
        ]);

        $owner = Owner::findOrFail($validated['owner_id']);

        $relatedModel = null;
        if (!empty($validated['related_type']) && !empty($validated['related_id'])) {
            try {
                $relatedModel = $validated['related_type']::findOrFail($validated['related_id']);
            } catch (\Exception $e) {
                // Ignore if model not found
            }
        }

        $message = '';
        $title = $validated['title'] ?? 'Notification from AutoVet';

        if (!empty($validated['template_id'])) {
            $template = NotificationTemplate::findOrFail($validated['template_id']);
            // Build context variables from related model and clinic settings
            $variables = $this->buildContextVariables($owner, $validated);

            $message = $this->service->interpolateVariables($template->body, $variables, $owner, $relatedModel);
            if ($template->subject && $validated['channel'] === 'email') {
                $title = $this->service->interpolateVariables($template->subject, $variables, $owner, $relatedModel);
            }
        } else if (!empty($validated['custom_message'])) {
            $message = $this->service->interpolateVariables($validated['custom_message'], [], $owner, $relatedModel);
        } else {
            return response()->json(['message' => 'Must provide either custom_message or template_id'], 422);
        }

        try {
            $notification = $this->service->send($owner, $validated['channel'], $message, $title, 'manual', $relatedModel);
            return response()->json($notification);
        } catch (\Exception $e) {
            return response()->json([
                'message' => 'Failed to send notification: ' . $e->getMessage(),
                'error' => $e->getMessage()
            ], 422);
        }
    }

    /**
     * Build context variables for template interpolation from related models and settings.
     */
    private function buildContextVariables(Owner $owner, array $validated): array
    {
        $variables = [];

        // Clinic settings (key-value store)
        try {
            $clinicName = \App\Models\Setting::where('key', 'clinic_name')->value('value');
            $variables['clinic_name'] = $clinicName ?? 'Our Clinic';
        } catch (\Exception $e) {
            $variables['clinic_name'] = 'Our Clinic';
        }

        // Related model context (appointment, invoice, etc.)
        if (!empty($validated['related_id'])) {
            // Try to load appointment context
            $appointment = \App\Models\Appointment::with('pet', 'service', 'vet')
                ->find($validated['related_id']);

            if ($appointment) {
                $variables['appointment_date'] = $appointment->date
                    ? \Carbon\Carbon::parse($appointment->date)->format('F j, Y')
                    : '';
                $variables['appointment_time'] = $appointment->time
                    ? \Carbon\Carbon::parse($appointment->time)->format('g:i A')
                    : '';
                $variables['pet_name'] = $appointment->pet->name ?? '';
                $variables['service_name'] = $appointment->service->name ?? '';
                $variables['vet_name'] = $appointment->vet->name ?? '';
                $variables['date'] = $variables['appointment_date'];
                $variables['time'] = $variables['appointment_time'];
                $variables['title'] = $appointment->title ?? '';
            }

            // Try to load pet context if not already set from appointment
            if (empty($variables['pet_name'])) {
                $pet = \App\Models\Pet::find($validated['related_id']);
                if ($pet) {
                    $variables['pet_name'] = $pet->name;
                }
            }
        }

        // Also try to get pet names from owner's pets if still empty
        if (empty($variables['pet_name']) && $owner->pets->count() > 0) {
            $variables['pet_name'] = $owner->pets->first()->name ?? '';
        }

        return $variables;
    }

    /**
     * Retry a failed notification.
     */
    public function retry(ClientNotification $notification)
    {
        try {
            $updated = $this->service->retry($notification);
            return response()->json($updated);
        } catch (\Exception $e) {
            return response()->json([
                'message' => 'Retry failed: ' . $e->getMessage()
            ], 422);
        }
    }
}
