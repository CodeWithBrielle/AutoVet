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
        // 1. Harden User Uniqueness (Active records only to handle soft deletes)
        Schema::table('users', function (Blueprint $table) {
            // Check if standard unique email index exists and drop it
            $indexes = DB::select("SHOW INDEX FROM users WHERE Key_name = 'users_email_unique' OR Column_name = 'email'");
            foreach ($indexes as $index) {
                if ($index->Non_unique == 0 && $index->Key_name != 'PRIMARY') {
                    $keyName = $index->Key_name;
                    DB::statement("ALTER TABLE users DROP INDEX {$keyName}");
                }
            }
        });

        DB::statement("ALTER TABLE users ADD active_email VARCHAR(255) AS (IF(deleted_at IS NULL, email, NULL)) VIRTUAL");
        
        Schema::table('users', function (Blueprint $table) {
            $table->unique('active_email', 'users_active_email_unique');
        });

        // 2. Harden Foreign Key Constraints (Switch from Cascade to Restrict for critical history)
        
        // PETS -> OWNERS
        Schema::table('pets', function (Blueprint $table) {
            try {
                $table->dropForeign(['owner_id']);
                $table->foreign('owner_id')->references('id')->on('owners')->onDelete('restrict');
            } catch (\Exception $e) {}
        });

        // MEDICAL RECORDS -> PETS
        Schema::table('medical_records', function (Blueprint $table) {
            try {
                $table->dropForeign(['pet_id']);
                $table->foreign('pet_id')->references('id')->on('pets')->onDelete('restrict');
            } catch (\Exception $e) {}
        });

        // INVOICES -> PETS
        Schema::table('invoices', function (Blueprint $table) {
            try {
                $table->dropForeign(['pet_id']);
                // Note: invoices already uses 'pet_id' name as per recent migration
                $table->foreign('pet_id')->references('id')->on('pets')->onDelete('restrict');
            } catch (\Exception $e) {}
        });
        
        // 3. Ensure Services and Inventories names are unique (Active only)
        Schema::table('services', function (Blueprint $table) {
            // Check if standard unique name index exists and drop it
            $indexes = DB::select("SHOW INDEX FROM services WHERE Key_name = 'services_name_unique' OR Column_name = 'name'");
            foreach ($indexes as $index) {
                if ($index->Non_unique == 0 && $index->Key_name != 'PRIMARY') {
                    $keyName = $index->Key_name;
                    DB::statement("ALTER TABLE services DROP INDEX {$keyName}");
                }
            }
        });

        DB::statement("ALTER TABLE services ADD active_name VARCHAR(255) AS (IF(deleted_at IS NULL, name, NULL)) VIRTUAL");
        
        Schema::table('services', function (Blueprint $table) {
            $table->unique('active_name', 'services_active_name_unique');
        });

        Schema::table('inventories', function (Blueprint $table) {
            // Check if standard unique item_name index exists and drop it
            $indexes = DB::select("SHOW INDEX FROM inventories WHERE Key_name = 'inventories_item_name_unique' OR Column_name = 'item_name'");
            foreach ($indexes as $index) {
                if ($index->Non_unique == 0 && $index->Key_name != 'PRIMARY') {
                    $keyName = $index->Key_name;
                    DB::statement("ALTER TABLE inventories DROP INDEX {$keyName}");
                }
            }
        });

        DB::statement("ALTER TABLE inventories ADD active_item_name VARCHAR(255) AS (IF(deleted_at IS NULL, item_name, NULL)) VIRTUAL");
        
        Schema::table('inventories', function (Blueprint $table) {
            $table->unique('active_item_name', 'inventories_active_item_name_unique');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('users', function (Blueprint $table) {
            $table->dropUnique('users_active_email_unique');
            $table->dropColumn('active_email');
        });

        Schema::table('services', function (Blueprint $table) {
            $table->dropUnique('services_active_name_unique');
            $table->dropColumn('active_name');
        });

        Schema::table('inventories', function (Blueprint $table) {
            $table->dropUnique('inventories_active_item_name_unique');
            $table->dropColumn('active_item_name');
        });
    }
};
