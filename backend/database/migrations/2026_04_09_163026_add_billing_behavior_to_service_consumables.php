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
        Schema::table('service_consumables', function (Blueprint $table) {
            $table->string('billing_behavior')->default('separately_billable')->after('is_billable');
        });

        // Set default based on existing `is_billable`
        \Illuminate\Support\Facades\DB::update("UPDATE service_consumables SET billing_behavior = CASE WHEN is_billable = 1 THEN 'separately_billable' ELSE 'internal_only' END");
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('service_consumables', function (Blueprint $table) {
            $table->dropColumn('billing_behavior');
        });
    }
};
