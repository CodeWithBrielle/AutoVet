<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('admins', function (Blueprint $table) {
            $table->id();
            $table->string('name');
            $table->string('email')->unique();
            $table->string('password');
            $table->string('role')->default('staff');
            $table->string('status')->default('active');
            $table->longText('avatar')->nullable();
            $table->boolean('must_change_password')->default(false);
            $table->rememberToken();
            $table->timestamps();
            $table->softDeletes();
        });

        Schema::create('portal_users', function (Blueprint $table) {
            $table->id();
            $table->string('name');
            $table->string('email')->unique();
            $table->string('password');
            $table->string('status')->default('active');
            $table->rememberToken();
            $table->timestamps();
            $table->softDeletes();
        });

        // Data Migration Logic
        if (Schema::hasTable('users')) {
            $users = DB::table('users')->get();
            foreach ($users as $user) {
                if (in_array($user->role, ['admin', 'veterinarian', 'staff'])) {
                    DB::table('admins')->insert([
                        'id' => $user->id,
                        'name' => $user->name,
                        'email' => $user->email,
                        'password' => $user->password,
                        'role' => $user->role,
                        'status' => $user->status ?? 'active',
                        'avatar' => $user->avatar,
                        'must_change_password' => $user->must_change_password ?? false,
                        'created_at' => $user->created_at,
                        'updated_at' => $user->updated_at,
                        'deleted_at' => $user->deleted_at,
                    ]);
                } else if ($user->role === 'owner') {
                    DB::table('portal_users')->insert([
                        'id' => $user->id,
                        'name' => $user->name,
                        'email' => $user->email,
                        'password' => $user->password,
                        'status' => $user->status ?? 'active',
                        'created_at' => $user->created_at,
                        'updated_at' => $user->updated_at,
                        'deleted_at' => $user->deleted_at,
                    ]);
                }
            }
        }
    }

    public function down(): void
    {
        Schema::dropIfExists('admins');
        Schema::dropIfExists('portal_users');
    }
};
