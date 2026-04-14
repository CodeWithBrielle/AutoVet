<?php
/*
|--------------------------------------------------------------------------
| IntegrityTestController
|--------------------------------------------------------------------------
|
| This controller is gated to the 'local' environment and is strictly for
| engineering verification of transaction rollbacks and collision recovery.
| DO NOT USE IN PRODUCTION.
|
*/

namespace App\Http\Controllers;

use App\Models\Owner;
use App\Models\Pet;
use App\Models\Appointment;
use App\Models\MedicalRecord;
use App\Models\User;
use App\Models\Service;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\App;

class IntegrityTestController extends Controller
{
    public function __construct()
    {
        if (!App::environment('local')) {
            abort(404, 'Test endpoints only available in local environment.');
        }
    }

    /**
     * PROOF OF ROLLBACK Test
     * Forces a failure mid-transaction in a Treatment Recording flow.
     */
    public function testRollback(Request $request)
    {
        $owner = Owner::first() ?? Owner::create([
            'name' => 'Integrity Test',
            'phone' => '09990000000',
            'email' => 'integrity@test.com',
            'city' => 'Manila',
            'province' => 'Metro Manila',
            'zip' => '1234'
        ]);

        $pet = Pet::first() ?? Pet::create([
            'owner_id' => $owner->id,
            'name' => 'RollbackBot',
            'species' => 'Canine',
            'breed' => 'Test'
        ]);

        $vet = User::where('role', 'veterinarian')->first() ?? User::first();
        $service = Service::first() ?? Service::create(['name' => 'Checkup', 'price_mode' => 'fixed', 'base_price' => 500]);

        $appt = Appointment::create([
            'owner_id' => $owner->id,
            'pet_id' => $pet->id,
            'vet_id' => $vet->id,
            'service_id' => $service->id,
            'date' => now()->addDay()->format('Y-m-d'),
            'time' => '10:00',
            'status' => 'pending',
            'title' => 'Rollback Test Appt'
        ]);

        $initialApptStatus = $appt->status;

        DB::beginTransaction();
        try {
            // 1. Create a partial record
            $record = MedicalRecord::create([
                'pet_id' => $pet->id,
                'appointment_id' => $appt->id,
                'vet_id' => $vet->id,
                'chief_complaint' => 'FORCED FAILURE TEST',
            ]);

            // 2. FORCE FAILURE before appointment update
            throw new \Exception("SIMULATED_INTEGRITY_FAILURE: Testing rollback atomicity.");

            // This would normally happen:
            $appt->update(['status' => 'completed']);

            DB::commit();
        } catch (\Exception $e) {
            DB::rollBack();
            
            // Verify Rollback
            $recordExists = MedicalRecord::where('appointment_id', $appt->id)->exists();
            $apptRefreshed = $appt->fresh();

            return response()->json([
                'success' => true,
                'test_scenario' => 'Proof of Rollback',
                'exception_caught' => $e->getMessage(),
                'results' => [
                    'medical_record_persisted' => $recordExists, // Should be false
                    'appointment_status_reverted' => ($apptRefreshed->status === $initialApptStatus), // Should be true
                    'rollback_verified' => (!$recordExists && $apptRefreshed->status === $initialApptStatus)
                ]
            ]);
        }

        return response()->json(['success' => false, 'message' => 'Test failed to encounter expected exception.'], 500);
    }

    /**
     * COLLISION RECOVERY Test
     * Demonstrates DB-level uniqueness catching a manual-check bypass.
     */
    public function testCollision(Request $request)
    {
        $phone = '09885551234';
        
        // Clean up previous test runs if any
        Owner::where('phone', $phone)->forceDelete();

        // 1. Create original
        $original = Owner::create([
            'name' => 'Original Record',
            'phone' => $phone,
            'email' => 'original@collision.com',
            'city' => 'Manila',
            'province' => 'Metro Manila',
            'zip' => '1234'
        ]);

        // 2. Attempt duplicate creation via direct route to verify OwnerController behavior
        $controller = new OwnerController();
        $fakeRequest = new Request([
            'name' => 'Duplicate Attempt',
            'phone' => $phone,
            'email' => 'duplicate@collision.com',
            'address' => 'Test',
            'zip' => '1234',
            'city' => 'Manila',
            'province' => 'Metro Manila'
        ]);

        $response = $controller->store($fakeRequest);
        $data = json_decode($response->getContent(), true);

        return response()->json([
            'success' => true,
            'test_scenario' => 'Collision Recovery',
            'results' => [
                'status_code' => $response->getStatusCode(),
                'error_code' => $data['error_code'] ?? null,
                'conflict_source' => $data['conflict_source'] ?? null,
                'existing_record_attached' => isset($data['existing_record']),
                'match_check' => (isset($data['existing_record']) && $data['existing_record']['id'] === $original->id)
            ]
        ]);
    }
}
