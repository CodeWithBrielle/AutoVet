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
            $table->string('line_type')->default('item')->after('item_type');
            $table->decimal('unit_price_snapshot', 12, 2)->nullable()->after('unit_price');
            $table->decimal('line_total_snapshot', 12, 2)->nullable()->after('amount');
            $table->boolean('is_billable')->default(true)->after('line_total_snapshot');
            $table->json('metadata_snapshot')->nullable()->after('is_billable');
            $table->string('reference_type')->nullable()->after('metadata_snapshot');
            $table->unsignedBigInteger('reference_id')->nullable()->after('reference_type');
        });

        Schema::table('service_pricing_rules', function (Blueprint $table) {
            $table->unsignedBigInteger('species_id')->nullable()->after('service_id');
            $table->unsignedBigInteger('breed_id')->nullable()->after('species_id');
            $table->unsignedBigInteger('size_category_id')->nullable()->after('breed_id');
            $table->decimal('min_weight', 8, 2)->nullable()->after('size_category_id');
            $table->decimal('max_weight', 8, 2)->nullable()->after('min_weight');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('invoice_items', function (Blueprint $table) {
            $table->dropColumn(['line_type', 'unit_price_snapshot', 'line_total_snapshot', 'is_billable', 'metadata_snapshot', 'reference_type', 'reference_id']);
        });

        Schema::table('service_pricing_rules', function (Blueprint $table) {
            $table->dropColumn(['species_id', 'breed_id', 'size_category_id', 'min_weight', 'max_weight']);
        });
    }
};
