<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class InventoryBatch extends Model
{
    protected $fillable = [
        'inventory_id',
        'batch_number',
        'quantity',
        'expiration_date',
        'received_date',
        'supplier',
        'status',
    ];

    protected $casts = [
        'expiration_date' => 'date',
        'received_date' => 'date',
    ];

    public function inventory()
    {
        return $this->belongsTo(Inventory::class);
    }

    /**
     * Check if expired and auto-update status
     */
    public function checkAndMarkExpired(): void
    {
        if ($this->expiration_date->isPast() && $this->status === 'Active') {
            $this->status = 'Expired';
            $this->save();
        }
    }
}
