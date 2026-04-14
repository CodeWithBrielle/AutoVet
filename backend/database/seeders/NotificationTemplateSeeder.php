<?php

namespace Database\Seeders;

use Illuminate\Database\Seeder;
use App\Models\NotificationTemplate;

class NotificationTemplateSeeder extends Seeder
{
    /**
     * Run the database seeds.
     */
    public function run(): void
    {
        $templates = [
            // 1. Appointment Booked
            [
                'event_key' => 'appointment_booked',
                'channel' => 'email',
                'name' => 'Appointment Confirmation (Email)',
                'subject' => 'Confirmed: Your Appointment at [clinic_name]',
                'body' => "Hello [owner_name],\n\nYour appointment for [pet_name] has been successfully booked.\n\n📅 Date: [appointment_date]\n⏰ Time: [appointment_time]\n🐾 Service: [service_name]\n\nThank you for choosing [clinic_name]!",
                'is_active' => true,
            ],
            [
                'event_key' => 'appointment_booked',
                'channel' => 'sms',
                'name' => 'Appointment Confirmation (SMS)',
                'subject' => null,
                'body' => "Hi [owner_name]! Appt for [pet_name] booked @ [clinic_name]. Date: [appointment_date] Time: [appointment_time]. See you!",
                'is_active' => true,
            ],

            // 2. Appointment Approved
            [
                'event_key' => 'appointment_approved',
                'channel' => 'email',
                'name' => 'Appointment Approved (Email)',
                'subject' => 'Approved: Your Visit to [clinic_name]',
                'body' => "Good day [owner_name],\n\nWe are pleased to inform you that your appointment for [pet_name] on [appointment_date] has been APPROVED.\n\nVet: [vet_name]\nService: [service_name]\n\nPlease arrive 10 mins early. See you soon!",
                'is_active' => true,
            ],
            [
                'event_key' => 'appointment_approved',
                'channel' => 'sms',
                'name' => 'Appointment Approved (SMS)',
                'subject' => null,
                'body' => "Great news [owner_name]! Your appt for [pet_name] on [appointment_date] is APPROVED by [clinic_name]. Vet: [vet_name].",
                'is_active' => true,
            ],

            // 3. Appointment Rejected
            [
                'event_key' => 'appointment_rejected',
                'channel' => 'email',
                'name' => 'Appointment Rejected (Email)',
                'subject' => 'Update: Your Appointment at [clinic_name]',
                'body' => "Hello [owner_name],\n\nRegrettably, we cannot fulfill your appointment request for [pet_name] on [appointment_date] at this time.\n\nReason: [rejection_reason]\n\nPlease contact us at [clinic_phone] to reschedule.",
                'is_active' => true,
            ],
            [
                'event_key' => 'appointment_rejected',
                'channel' => 'sms',
                'name' => 'Appointment Rejected (SMS)',
                'subject' => null,
                'body' => "Hi [owner_name], your appt for [pet_name] on [appointment_date] was declined. Reason: [rejection_reason]. Pls call [clinic_phone] to reschedule.",
                'is_active' => true,
            ],

            // 4. Appointment Reminder
            [
                'event_key' => 'appointment_reminder',
                'channel' => 'sms',
                'name' => 'Appointment Reminder (SMS)',
                'subject' => null,
                'body' => "Reminder: [pet_name] has an appt at [clinic_name] tomorrow ([appointment_date]) at [appointment_time]. Please reply to confirm or call to reschedule.",
                'is_active' => true,
            ],

            // 5. Invoice Ready
            [
                'event_key' => 'invoice_ready',
                'channel' => 'email',
                'name' => 'Invoice Ready (Email)',
                'subject' => 'Invoice #[invoice_number] from [clinic_name]',
                'body' => "Hello [owner_name],\n\nThe medical services for [pet_name] have been completed. Your invoice #[invoice_number] for [total] is now ready.\n\nYou can view and pay your bill at the clinic counter or via our portal.\n\nThank you!",
                'is_active' => true,
            ],

            // 6. Internal Low Stock
            [
                'event_key' => 'internal_low_stock',
                'channel' => 'email',
                'name' => 'Low Stock Alert (Internal)',
                'subject' => 'INTERNAL ALERT: Low Stock for [item_name]',
                'body' => "SYSTEM ALERT:\n\nInventory item [item_name] (SKU: [sku]) has reached its threshold.\n\nCurrent Level: [current_stock]\nThreshold: [min_stock]\n\nPlease review inventory and reorder soon.",
                'is_active' => true,
            ],
        ];

        foreach ($templates as $template) {
            NotificationTemplate::updateOrCreate(
                ['event_key' => $template['event_key'], 'channel' => $template['channel']],
                $template
            );
        }
    }
}
