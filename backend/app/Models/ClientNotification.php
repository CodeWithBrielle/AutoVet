<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class ClientNotification extends Model
{
    use HasFactory;

    protected $fillable = [
        'owner_id',
        'recipient_email',
        'recipient_phone',
        'channel',
        'type',
        'event_key',
        'unique_hash',
        'title',
        'message',
        'status',
        'attempts',
        'max_attempts',
        'related_type',
        'related_id',
        'sent_at',
        'failed_at',
        'last_attempt_at',
        'error_message',
        'metadata',
    ];

    protected $casts = [
        'sent_at' => 'datetime',
        'failed_at' => 'datetime',
        'last_attempt_at' => 'datetime',
        'metadata' => 'array',
    ];

    public function owner()
    {
        return $this->belongsTo(Owner::class);
    }

    public function related()
    {
        return $this->morphTo();
    }
}
