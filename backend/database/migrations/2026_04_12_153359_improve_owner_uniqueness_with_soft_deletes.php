<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        Schema::table('owners', function (Blueprint $table) {
            // 1. Drop the temporary simple unique indexes we applied
            // We use try-catch or check if they exist to be safe
            try {
                $table->dropUnique(['email']);
            } catch (\Exception $e) {}
            
            try {
                $table->dropUnique(['phone']);
            } catch (\Exception $e) {}

            // 2. Add Virtual Columns for Active uniqueness (respecting soft deletes)
            // MySQL syntax for virtual columns: (Expression) VIRTUAL
            // We use raw SQL because Laravel's virtualColumn() support varies by DB driver
            DB::statement("ALTER TABLE owners ADD active_email VARCHAR(255) AS (IF(deleted_at IS NULL, email, NULL)) VIRTUAL");
            DB::statement("ALTER TABLE owners ADD active_phone VARCHAR(20) AS (IF(deleted_at IS NULL, phone, NULL)) VIRTUAL");

            // 3. Add Unique indexes on these virtual columns
            $table->unique('active_email', 'owners_active_email_unique');
            $table->unique('active_phone', 'owners_active_phone_unique');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('owners', function (Blueprint $table) {
            $table->dropUnique('owners_active_email_unique');
            $table->dropUnique('owners_active_phone_unique');
            $table->dropColumn(['active_email', 'active_phone']);
            
            // Restore basic unique constraints if needed, but usually we don't want to go back to the broken state
            $table->unique('email');
            $table->unique('phone');
        });
    }
};
