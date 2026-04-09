<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    public function up(): void
    {
        // Safe drop using raw SQL and DB statement
        try {
            DB::statement('ALTER TABLE invoices DROP FOREIGN KEY invoices_patient_id_foreign');
        } catch (\Exception $e) {
            // Ignore
        }
        
        try {
            DB::statement('ALTER TABLE invoices DROP FOREIGN KEY invoices_pet_id_foreign');
        } catch (\Exception $e) {
            // Ignore
        }

        try {
            DB::statement('ALTER TABLE invoices DROP KEY invoices_patient_id_foreign');
        } catch (\Exception $e) {
            // Ignore
        }
        
        try {
            DB::statement('ALTER TABLE invoices DROP KEY invoices_pet_id_foreign');
        } catch (\Exception $e) {
            // Ignore
        }

        // Now link it to pets properly
        Schema::table('invoices', function (Blueprint $table) {
            try {
                $table->foreign('pet_id', 'invoices_pet_id_foreign')->references('id')->on('pets')->onDelete('restrict');
            } catch (\Exception $e) {
                // Maybe it was already fixed
            }
        });
    }

    public function down(): void
    {
        try {
            DB::statement('ALTER TABLE invoices DROP FOREIGN KEY invoices_pet_id_foreign');
        } catch (\Exception $e) {
            // Ignore
        }
    }
};
