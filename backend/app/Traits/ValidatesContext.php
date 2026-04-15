<?php

namespace App\Traits;

use App\Models\Pet;
use App\Models\Appointment;
use App\Models\Invoice;

trait ValidatesContext
{
    /**
     * Verify that a pet belongs to a specific owner.
     */
    protected function isPetOwnedBy(int $petId, int $ownerId): bool
    {
        return Pet::where('id', $petId)->where('owner_id', $ownerId)->exists();
    }

    /**
     * Verify that an appointment matches a specific pet.
     */
    protected function isAppointmentValidForPet(int $appointmentId, int $petId): bool
    {
        return Appointment::where('id', $appointmentId)->where('pet_id', $petId)->exists();
    }

    /**
     * Verify that an invoice matches the owner and pet context.
     * Optionally verifies the associated appointment.
     */
    protected function isInvoiceValidForContext(int $invoiceId, int $petId, int $ownerId, ?int $appointmentId = null): bool
    {
        $query = Invoice::where('id', $invoiceId)
            ->where('pet_id', $petId);

        // Verify owner through pet relationship (extra safety)
        $pet = Pet::find($petId);
        if (!$pet || $pet->owner_id != $ownerId) {
            return false;
        }

        if ($appointmentId) {
            $query->where('appointment_id', $appointmentId);
        }

        return $query->exists();
    }
}
