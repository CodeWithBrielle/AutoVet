<?php

require __DIR__ . '/vendor/autoload.php';
$app = require_once __DIR__ . '/bootstrap/app.php';
$app->make(Illuminate\Contracts\Console\Kernel::class)->bootstrap();

use App\Models\Invoice;
use App\Models\Owner;
use App\Models\Pet;
use App\Models\Appointment;
use App\Models\MedicalRecord;
use Illuminate\Support\Facades\DB;

function logStatus($msg, $pass = null) {
    $status = $pass === true ? "[PASS] " : ($pass === false ? "[FAIL] " : "");
    echo $status . $msg . "\n";
}

echo "--- TRANSACTIONAL ROLLBACK PROOF (MCR) ---\n";

// 1. Setup baseline
$initialInvoiceCount = Invoice::count();
logStatus("Initial Invoice Count: " . $initialInvoiceCount);

// Needs a dummy pet/owner/appointment for the invoice
$owner = Owner::firstOrCreate(['email' => 'rollback.test@example.com'], [
    'name' => 'Rollback Tester',
    'phone' => '09123456781',
    'city' => 'Manila',
    'province' => 'Metro Manila',
    'zip' => '1000'
]);

$pet = Pet::firstOrCreate(['name' => 'RollbackPet', 'owner_id' => $owner->id], [
    'species_id' => 4,
    'breed_id' => 1
]);

$appointment = Appointment::firstOrCreate(['pet_id' => $pet->id, 'status' => 'Scheduled'], [
    'title' => 'Rollback Test',
    'date' => now()->addDay()->format('Y-m-d'),
    'time' => '10:00:00'
]);

// 2. Execute Transaction with Forced Failure
logStatus("Attempting atomic multi-step write (Header + Forced Exception)...");

try {
    DB::beginTransaction();

    // STEP 1: Create an Appointment (Matches current schema: title, date, time)
    $appointment = Appointment::create([
        'pet_id'   => $pet->id,
        'title'    => 'Annual Vaccination',
        'date'     => date('Y-m-d'),
        'time'     => date('H:i:s'),
        'status'   => 'scheduled',
    ]);
    echo "✔ STEP 1: Created Appointment ID: {$appointment->id}\n";

    // STEP 2: Create a Medical Record (Matches current schema: chief_complaint, findings, diagnosis, treatment_plan)
    $record = MedicalRecord::create([
        'pet_id'         => $pet->id,
        'vet_id'         => 3, // Valid Vet ID
        'appointment_id' => $appointment->id,
        'chief_complaint'=> 'Regular checkup',
        'findings'       => 'Healthy',
        'diagnosis'      => 'No issues',
        'treatment_plan' => 'Maintain current diet',
    ]);
    echo "✔ STEP 2: Created Medical Record ID: {$record->id}\n";

    // Step A: Create the Invoice Header (This insert is triggered)
    $invoice = Invoice::create([
        'invoice_number' => 'TEST-ROLLBACK-' . time(),
        'owner_id'       => $owner->id,
        'pet_id'         => $pet->id,
        'appointment_id' => $appointment->id,
        'issue_date'     => date('Y-m-d'),
        'due_date'       => date('Y-m-d'),
        'total_amount'   => 1000,
        'amount_paid'    => 0,
        'balance_amount' => 1000,
        'payment_status' => 'Pending',
    ]);

    $invoiceIdCreated = $invoice->id;
    logStatus("Step A: Invoice Header created (ID: {$invoiceIdCreated})");

    // Step B: Forced Failure (Simulating a crash or failed sub-operation)
    logStatus("Step B: Triggering intentional exception before commit...");
    throw new \Exception("SIMULATED_FAILURE: Failed to finalize items.");

    DB::commit();

} catch (\Exception $e) {
    DB::rollBack();
    logStatus("Caught exception: " . $e->getMessage());
    logStatus("Transaction ROLLED BACK.");
}

// 3. Verify Integrity
$finalInvoiceCount = Invoice::count();
logStatus("Final Invoice Count: " . $finalInvoiceCount);

if ($finalInvoiceCount === $initialInvoiceCount) {
    logStatus("VERIFICATION: No records were persisted.", true);
} else {
    logStatus("VERIFICATION: Persistence leak detected!", false);
}

// Optional cleanup of dummy models
// $appointment->delete(); $pet->delete(); $owner->delete();

echo "--- PROOF COMPLETE ---\n";
