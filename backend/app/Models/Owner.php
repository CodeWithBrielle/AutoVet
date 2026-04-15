<?php

namespace App\Models;

use App\Traits\Archivable;
use App\Traits\HasAuditTrail;
use App\Traits\HasSyncFields;
use App\Traits\HasAuditTrail;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\SoftDeletes;
use App\Models\Pet;
use App\Models\PortalUser;
use App\Models\Notification;

class Owner extends Model
{
    use SoftDeletes, HasSyncFields, Archivable, HasAuditTrail, \App\Traits\NormalizesData;
    
    protected $fillable = [
        'name', 'phone', 'email', 'address', 'city', 'province', 'zip', 'user_id',
        // Archive tracking
        'deleted_by', 'restore_until',
        // Sync fields
        'uuid', 'sync_status', 'synced_at', 'last_modified_locally_at',
    ];

    protected static function booted()
    {
        static::saving(function ($owner) {
            $owner->phone = $owner->normalizePhone($owner->phone);
            $owner->email = $owner->normalizeEmail($owner->email);
        });

        static::created(function ($owner) {
            Notification::create([
                'type' => 'OwnerRegistered',
                'title' => 'New Owner Registered',
                'message' => "{$owner->name} has been added to the system.",
                'data' => [
                    'owner_id' => $owner->id,
                    'name' => $owner->name
                ]
            ]);
        });
    }

    protected $casts = [
        'synced_at'                => 'datetime',
        'last_modified_locally_at' => 'datetime',
    ];

    public function user()
    {
        return $this->belongsTo(PortalUser::class, 'user_id');
    }

    public function pets()
    {
        return $this->hasMany(Pet::class);
    }

    public function preventPermanentDeletionIfReferenced()
    {
        if ($this->pets()->exists()) {
            throw new \Exception("Cannot permanently delete this owner because they still have registered pets.");
        }
    }
}
