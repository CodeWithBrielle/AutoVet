<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        Schema::table('inventories', function (Blueprint $table) {
            $table->renameColumn('is_billable', 'is_sellable');
            $table->renameColumn('is_consumable', 'is_service_usable');
            $table->renameColumn('price', 'cost_price');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('inventories', function (Blueprint $table) {
            $table->renameColumn('is_sellable', 'is_billable');
            $table->renameColumn('is_service_usable', 'is_consumable');
            $table->renameColumn('cost_price', 'price');
        });
    }
};
