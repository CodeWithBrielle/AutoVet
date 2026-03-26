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
        // 1. Data Migration: Move data from settings to new tables
        $this->migrateCategories();

        // 2. Modify inventories table
        Schema::table('inventories', function (Blueprint $table) {
            $table->foreignId('category_id')->nullable()->constrained('inventory_categories')->onDelete('set null');
        });

        // Link existing inventories to category_id
        $this->linkInventories();

        // 3. Modify services table
        Schema::table('services', function (Blueprint $table) {
            $table->foreignId('category_id')->nullable()->constrained('service_categories')->onDelete('set null');
        });

        // Link existing services to category_id
        $this->linkServices();
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('services', function (Blueprint $table) {
            $table->dropForeign(['category_id']);
            $table->dropColumn('category_id');
        });

        Schema::table('inventories', function (Blueprint $table) {
            $table->dropForeign(['category_id']);
            $table->dropColumn('category_id');
        });
    }

    private function migrateCategories()
    {
        // Inventory Categories
        $invSetting = DB::table('settings')->where('key', 'inventory_categories')->first();
        if ($invSetting && !empty($invSetting->value)) {
            $categories = json_decode($invSetting->value, true);
            if (is_array($categories)) {
                foreach ($categories as $cat) {
                    DB::table('inventory_categories')->updateOrInsert(['name' => $cat], ['status' => 'Active', 'created_at' => now(), 'updated_at' => now()]);
                }
            }
        } else {
            // Default categories if setting is empty (based on InventoryController validation)
            $defaults = ['Consumables', 'Medicines', 'Retail', 'Supplies', 'Vaccines', 'Clinic assets'];
            foreach ($defaults as $cat) {
                DB::table('inventory_categories')->updateOrInsert(['name' => $cat], ['status' => 'Active', 'created_at' => now(), 'updated_at' => now()]);
            }
        }

        // Service Categories
        $svcSetting = DB::table('settings')->where('key', 'service_categories')->first();
        if ($svcSetting && !empty($svcSetting->value)) {
            $categories = json_decode($svcSetting->value, true);
            if (is_array($categories)) {
                foreach ($categories as $cat) {
                    DB::table('service_categories')->updateOrInsert(['name' => $cat], ['status' => 'Active', 'created_at' => now(), 'updated_at' => now()]);
                }
            }
        }
    }

    private function linkInventories()
    {
        $inventories = DB::table('inventories')->get();
        foreach ($inventories as $inv) {
            $category = DB::table('inventory_categories')->where('name', $inv->category)->first();
            if ($category) {
                DB::table('inventories')->where('id', $inv->id)->update(['category_id' => $category->id]);
            }
        }
    }

    private function linkServices()
    {
        $services = DB::table('services')->get();
        foreach ($services as $svc) {
            $category = DB::table('service_categories')->where('name', $svc->category)->first();
            if ($category) {
                DB::table('services')->where('id', $svc->id)->update(['category_id' => $category->id]);
            }
        }
    }
};
