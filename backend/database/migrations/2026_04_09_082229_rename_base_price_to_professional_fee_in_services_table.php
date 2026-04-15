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
        if (Schema::hasColumn('services', 'base_price')) {
            Schema::table('services', function (Blueprint $table) {
                $table->renameColumn('base_price', 'professional_fee');
            });
        }
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        if (Schema::hasColumn('services', 'professional_fee')) {
            Schema::table('services', function (Blueprint $table) {
                $table->renameColumn('professional_fee', 'base_price');
            });
        }
    }
};
