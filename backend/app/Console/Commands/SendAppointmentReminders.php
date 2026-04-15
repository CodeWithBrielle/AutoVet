<?php

namespace App\Console\Commands;

use Illuminate\Console\Command;
use App\Models\Appointment;
use App\Services\ClientNotificationService;

class SendAppointmentReminders extends Command
{
    /**
     * The name and signature of the console command.
     *
     * @var string
     */
    protected $signature = 'notifications:send-reminders';

    /**
     * The console command description.
     *
     * @var string
     */
    protected $description = 'Send SMS reminders for appointments scheduled for tomorrow.';

    protected $notificationService;

    public function __construct(ClientNotificationService $notificationService)
    {
        parent::__construct();
        $this->notificationService = $notificationService;
    }

    /**
     * Execute the console command.
     */
    public function handle()
    {
        $this->info("Starting appointment reminder sweep...");

        $tomorrow = now()->addDay()->toDateString();
        
        // Find appointments for tomorrow that are set to happen
        $appointments = Appointment::where('date', $tomorrow)
            ->whereIn('status', ['pending', 'confirmed', 'in_progress'])
            ->with(['pet.owner', 'service'])
            ->get();

        $count = 0;
        foreach ($appointments as $appointment) {
            $owner = $appointment->pet->owner ?? null;
            if (!$owner) continue;

            $variables = [
                'appointment_date' => \Carbon\Carbon::parse($appointment->date)->format('F j, Y'),
                'appointment_time' => \Carbon\Carbon::parse($appointment->time)->format('g:i A'),
                'pet_name' => $appointment->pet->name ?? 'your pet',
                'service_name' => $appointment->service->name ?? 'consultation',
            ];

            // SendFromTemplate handles IDEMPOTENCY check automatically
            $log = $this->notificationService->sendFromTemplate(
                $owner,
                'appointment_reminder',
                'sms',
                $variables,
                'automated',
                $appointment
            );

            if ($log && $log->status === 'sent') {
                $count++;
            }
        }

        $this->info("Successfully sent {$count} reminders.");
    }
}
