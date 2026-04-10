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
        Schema::table('invoice_items', function (Blueprint $table) {
            $table->string('billing_behavior')->default('separately_billable')->after('amount'); // included, separately_billable, internal_only
            $table->string('source_type')->default('custom')->after('billing_behavior'); // appointment_template, manual, custom
            $table->boolean('is_confirmed_used')->default(true)->after('source_type');
            $table->boolean('is_removed_from_template')->default(false)->after('is_confirmed_used');
            $table->boolean('was_price_overridden')->default(false)->after('is_removed_from_template');
            $table->boolean('was_quantity_overridden')->default(false)->after('was_price_overridden');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('invoice_items', function (Blueprint $table) {
            $table->dropColumn([
                'billing_behavior',
                'source_type',
                'is_confirmed_used',
                'is_removed_from_template',
                'was_price_overridden',
                'was_quantity_overridden'
            ]);
        });
    }
};
