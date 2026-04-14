<?php

namespace App\Services;

use App\Models\ClientNotification;
use App\Models\NotificationTemplate;
use App\Models\Owner;
use App\Services\Sms\SmsProviderInterface;
use Illuminate\Support\Facades\Mail;
use App\Mail\ClientNotificationMail;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;

class ClientNotificationService
{
    protected SmsProviderInterface $smsProvider;

    public function __construct(SmsProviderInterface $smsProvider)
    {
        $this->smsProvider = $smsProvider;
    }

    /**
     * Send a notification using a template with idempotency and safety.
     */
    public function sendFromTemplate(Owner $owner, string $eventKey, string $channel, array $variables = [], ?string $type = 'automated', $relatedModel = null)
    {
        try {
            // 1. Idempotency Check (Check if already sent successfully for this model/event/channel)
            if ($relatedModel && $this->isAlreadySent($eventKey, $relatedModel, $channel)) {
                Log::info("Notification skipped: Event '{$eventKey}' already sent via {$channel} for model " . get_class($relatedModel) . " #{$relatedModel->id}");
                return null;
            }

            $template = NotificationTemplate::where('event_key', $eventKey)
                ->where('channel', $channel)
                ->where('is_active', true)
                ->first();

            if (!$template) {
                Log::warning("Notification service: No active $channel template found for event '$eventKey'. Skipping.");
                return null;
            }

            $subject = $this->interpolateVariables($template->subject ?? '', $variables, $owner);
            $body = $this->interpolateVariables($template->body, $variables, $owner);

            return $this->send($owner, $channel, $body, $subject, $type, $relatedModel, $eventKey);

        } catch (\Exception $e) {
            Log::error("Failed to process notification from template: " . $e->getMessage());
            // We do NOT re-throw by default in automated flows to protect clinical transactions
            return null;
        }
    }

    /**
     * Send an internal alert to administrators.
     */
    public function sendInternalAlert(string $eventKey, string $message, ?string $title = null, array $channels = ['email'])
    {
        // For Phase 2, we send internal alerts to all active admins
        $admins = \App\Models\User::where('role', 'admin')->get();
        if ($admins->isEmpty()) {
            Log::warning("Internal Alert triggered but no admin users found.");
            return;
        }

        foreach ($admins as $admin) {
            foreach ($channels as $channel) {
                if ($channel === 'email' && $admin->email) {
                    try {
                        Mail::to($admin->email)->send(new ClientNotificationMail($title ?? 'AutoVet System Alert', $message));
                    } catch (\Exception $e) {
                        Log::error("Failed to send internal email alert to Admin #{$admin->id}: " . $e->getMessage());
                    }
                }
            }
        }
    }

    /**
     * Send a notification directly with hardening and audited logging.
     */
    public function send(Owner $owner, string $channel, string $message, ?string $title = null, ?string $type = 'manual', $relatedModel = null, ?string $eventKey = null)
    {
        // 1. Validation & Pre-flight
        if ($channel === 'email' && empty($owner->email)) {
            Log::warning("Cannot send email: Owner #{$owner->id} has no email address.");
            return $this->logFailure(null, $owner, $channel, $message, $title, $type, $relatedModel, $eventKey, "Missing email address");
        }
        if ($channel === 'sms' && empty($owner->phone)) {
            Log::warning("Cannot send SMS: Owner #{$owner->id} has no phone number.");
            return $this->logFailure(null, $owner, $channel, $message, $title, $type, $relatedModel, $eventKey, "Missing phone number");
        }

        // 2. Create the Log Record (SNAPSHOT recipient info)
        $uniqueHash = $this->generateUniqueHash($eventKey, $relatedModel, $channel);
        
        $notification = ClientNotification::create([
            'owner_id' => $owner->id,
            'recipient_email' => $owner->email,
            'recipient_phone' => $owner->phone,
            'channel' => $channel,
            'type' => $type,
            'event_key' => $eventKey,
            'unique_hash' => $uniqueHash,
            'title' => $title,
            'message' => $message,
            'status' => 'pending',
            'attempts' => 1,
            'last_attempt_at' => now(),
            'related_type' => $relatedModel ? get_class($relatedModel) : null,
            'related_id' => $relatedModel ? $relatedModel->id : null,
        ]);

        return $this->executeDelivery($notification);
    }

    /**
     * Execute the actual delivery logic for a pending notification record.
     */
    public function executeDelivery(ClientNotification $notification)
    {
        try {
            if ($notification->channel === 'email') {
                Mail::to($notification->recipient_email)->send(new ClientNotificationMail($notification->title ?? 'AutoVet Notification', $notification->message));
            } elseif ($notification->channel === 'sms') {
                $this->smsProvider->sendSms($notification->recipient_phone, $notification->message);
            } else {
                throw new \Exception("Unsupported notification channel: {$notification->channel}");
            }

            $notification->update([
                'status' => 'sent',
                'sent_at' => now(),
                'error_message' => null
            ]);

            return $notification;

        } catch (\Exception $e) {
            $notification->update([
                'status' => 'failed',
                'failed_at' => now(),
                'error_message' => $e->getMessage(),
            ]);

            Log::error("Notification Delivery Failed [#{$notification->id}]: " . $e->getMessage());
            return $notification;
        }
    }

    /**
     * Retry a failed notification.
     */
    public function retry(ClientNotification $notification)
    {
        if ($notification->status === 'sent') {
            throw new \Exception("Notification already successfully sent.");
        }

        if ($notification->attempts >= $notification->max_attempts) {
            throw new \Exception("Maximum retry attempts reached ({$notification->max_attempts}).");
        }

        $notification->increment('attempts');
        $notification->update(['last_attempt_at' => now(), 'status' => 'pending']);

        return $this->executeDelivery($notification);
    }

    /**
     * Check if a specific notification has already been sent.
     */
    protected function isAlreadySent(string $eventKey, $relatedModel, string $channel): bool
    {
        return ClientNotification::where('event_key', $eventKey)
            ->where('related_type', get_class($relatedModel))
            ->where('related_id', $relatedModel->id)
            ->where('channel', $channel)
            ->where('status', 'sent')
            ->exists();
    }

    /**
     * Generate a unique hash for idempotency.
     */
    protected function generateUniqueHash(?string $eventKey, $relatedModel, string $channel): ?string
    {
        if (!$eventKey || !$relatedModel) return null;
        
        return md5($eventKey . get_class($relatedModel) . $relatedModel->id . $channel);
    }

    /**
     * Helper to log initial validation failures.
     */
    protected function logFailure($id, Owner $owner, string $channel, string $message, ?string $title, string $type, $relatedModel, ?string $eventKey, string $error)
    {
        return ClientNotification::create([
            'owner_id' => $owner->id,
            'recipient_email' => $owner->email,
            'recipient_phone' => $owner->phone,
            'channel' => $channel,
            'type' => $type,
            'event_key' => $eventKey,
            'title' => $title,
            'message' => $message,
            'status' => 'failed',
            'attempts' => 0,
            'error_message' => $error,
            'failed_at' => now(),
            'related_type' => $relatedModel ? get_class($relatedModel) : null,
            'related_id' => $relatedModel ? $relatedModel->id : null,
        ]);
    }

    /**
     * Interpolate variables in a string.
     */
    public function interpolateVariables(string $text, array $variables, ?Owner $owner = null): string
    {
        if ($owner) {
            $variables['owner_name'] = $owner->name;
        }

        // Add common system variables
        $variables['clinic_name'] = \App\Models\Setting::where('key', 'clinic_name')->value('value') ?? 'AutoVet Clinic';

        foreach ($variables as $key => $value) {
            $text = str_replace('{' . $key . '}', $value ?? '', $text);
            $text = str_replace('[' . $key . ']', $value ?? '', $text);
        }

        return $text;
    }
}
