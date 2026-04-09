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
        Schema::table('services', function (Blueprint $table) {
            $table->boolean('show_on_invoice')->default(true)->after('status');
            $table->boolean('auto_load_linked_items')->default(true)->after('show_on_invoice');
            $table->boolean('allow_manual_item_override')->default(true)->after('auto_load_linked_items');
        });

        Schema::table('service_consumables', function (Blueprint $table) {
            $table->boolean('is_billable')->default(true)->after('quantity');
            $table->boolean('is_required')->default(false)->after('is_billable');
            $table->boolean('auto_deduct')->default(true)->after('is_required');
            $table->string('notes')->nullable()->after('auto_deduct');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('service_consumables', function (Blueprint $table) {
            $table->dropColumn(['is_billable', 'is_required', 'auto_deduct', 'notes']);
        });

        Schema::table('services', function (Blueprint $table) {
            $table->dropColumn(['show_on_invoice', 'auto_load_linked_items', 'allow_manual_item_override']);
        });
    }
};
