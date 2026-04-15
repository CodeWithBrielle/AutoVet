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
        Schema::table('client_notifications', function (Blueprint $table) {
            $table->string('recipient_email')->nullable()->after('owner_id');
            $table->string('recipient_phone')->nullable()->after('recipient_email');
            $table->integer('attempts')->default(0)->after('status');
            $table->integer('max_attempts')->default(3)->after('attempts');
            $table->json('metadata')->nullable()->after('error_message');
            $table->string('event_key')->nullable()->index()->after('type'); // appointment_booked, etc
            $table->string('unique_hash')->nullable()->unique()->after('event_key');
            
            // Allow manual overrides for resend if needed
            $table->timestamp('last_attempt_at')->nullable()->after('sent_at');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('client_notifications', function (Blueprint $table) {
            if (Schema::hasColumn('client_notifications', 'recipient_email')) {
                $table->dropColumn([
                    'recipient_email', 
                    'recipient_phone', 
                    'attempts', 
                    'max_attempts', 
                    'metadata', 
                    'event_key', 
                    'unique_hash',
                    'last_attempt_at'
                ]);
            }
        });
    }
};
