<?php
use Illuminate\Support\Facades\Schema;
use Illuminate\Database\Schema\Blueprint;

Schema::table('portal_users', function (Blueprint $table) {
    $table->dropColumn('phone');
});
echo "Column 'phone' dropped from portal_users.\n";
