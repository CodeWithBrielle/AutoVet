<?php

use App\Models\Owner;
use App\Models\Pet;
use App\Models\Appointment;
use App\Models\User;
use App\Models\Service;
use App\Models\Role;
use Illuminate\Support\Facades\DB;

require __DIR__ . '/vendor/autoload.php';
$app = require_once __DIR__ . '/bootstrap/app.php';
$app->make(Illuminate\Contracts\Console\Kernel::class)->bootstrap();

function logResult($test, $success) {
    echo ($success ? "[PASS] " : "[FAIL] ") . $test . "\n";
}

echo "--- PHASE 5 INTEGRITY VERIFICATION ---\n";

DB::beginTransaction();

try {
    // 1. Uniqueness & Normalization (Email)
    $ownerController = $app->make(\App\Http\Controllers\OwnerController::class);
    
    $email1 = "TEST@Example.com";
    $email2 = " test@example.com";
    
    $request1 = new \Illuminate\Http\Request([
        'name' => 'test one',
        'email' => $email1,
        'phone' => '09171234567',
        'address' => '123 test st',
        'city' => 'pasig',
        'province' => 'metro manila',
        'zip' => '1600'
    ]);
    
    $response1 = $ownerController->store($request1);
    $owner1 = $response1->getData()->data;
    
    logResult("Normalization - Email is lowercase/trimmed", $owner1->email === "test@example.com");
    logResult("Sanitization - Name is TitleCase", $owner1->name === "Test One");
    logResult("Sanitization - City is TitleCase", $owner1->city === "Pasig");
    logResult("Sanitization - Province is TitleCase", $owner1->province === "Metro Manila");

    $request2 = new \Illuminate\Http\Request([
        'name' => 'Test Two',
        'email' => trim($email2),
        'phone' => '09171234568',
        'city' => 'Manila',
        'province' => 'Metro Manila',
        'zip' => '1000'
    ]);
    
    $response2 = $ownerController->store($request2);
    logResult("Uniqueness - Duplicate email variants rejected (Controller Level)", $response2->getStatusCode() === 422);

    // 2. Uniqueness & Normalization (Phone)
    $phone1 = "09178881234";
    $phone2 = "+639178881234";
    
    $request3 = new \Illuminate\Http\Request([
        'name' => 'Test Three',
        'email' => 't3@example.com',
        'phone' => $phone1,
        'city' => 'Pasig',
        'province' => 'Metro Manila',
        'zip' => '1600'
    ]);
    
    $response3 = $ownerController->store($request3);
    $owner3 = $response3->getData()->data;
    
    logResult("Normalization - Phone 09 format (+63)", $owner3->phone === "+639178881234");
    
    $request4 = new \Illuminate\Http\Request([
        'name' => 'Test Four',
        'email' => 't4@example.com',
        'phone' => $phone2,
        'city' => 'Pasig',
        'province' => 'Metro Manila',
        'zip' => '1600'
    ]);
    $response4 = $ownerController->store($request4);
    logResult("Uniqueness - Duplicate phone (+63 vs 09) rejected", $response4->getStatusCode() === 422);

    // 3. Hierarchy Mismatch
    $ownerA = $owner1;
    $ownerB = $owner3;
    $petA = Pet::create([
        'owner_id' => $ownerA->id,
        'name' => 'Dog A',
        'weight' => 10
    ]);
    
    $apptController = $app->make(\App\Http\Controllers\AppointmentController::class);
    $reflection = new \ReflectionClass($apptController);
    $method = $reflection->getMethod('isPetOwnedBy');
    $method->setAccessible(true);
    
    logResult("Hierarchy - isPetOwnedBy check", $method->invoke($apptController, $petA->id, $ownerA->id) === true);
    logResult("Hierarchy - isPetOwnedBy rejection check", $method->invoke($apptController, $petA->id, $ownerB->id) === false);

    // 4. Restricted Deletion (DB Constraint Check)
    try {
        Owner::find($ownerA->id)->delete(); 
        logResult("Restricted Delete - Owner with pets check", false);
    } catch (\Illuminate\Database\QueryException $e) {
        logResult("Restricted Delete - Owner with pets check (Caught SQL error)", true);
    }

} catch (\Exception $e) {
    echo "ERROR: " . $e->getMessage() . "\n";
} finally {
    DB::rollBack();
    echo "--- TEST COMPLETE (ROLLBACK) ---\n";
}
