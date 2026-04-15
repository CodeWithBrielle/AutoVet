<?php

namespace App\Models;

use App\Traits\HasAuditTrail;
use App\Traits\HasSyncFields;
use Illuminate\Database\Eloquent\Model;

class InvoiceItem extends Model
{
    use HasSyncFields, HasAuditTrail;

    protected $guarded = [];

    protected $appends = [
        'resolved_unit_price',
        'resolved_total',
    ];

    protected $casts = [
        'synced_at'                => 'datetime',
        'last_modified_locally_at' => 'datetime',
        'metadata_snapshot'        => 'array',
        'is_billable'              => 'boolean',
    ];

    /**
     * Get the resolved price, preferring snapshot for finalized invoices.
     */
    public function getResolvedUnitPriceAttribute()
    {
        return $this->unit_price_snapshot ?? $this->unit_price;
    }

    /**
     * Get the resolved total, preferring snapshot for finalized invoices.
     */
    public function getResolvedTotalAttribute()
    {
        return $this->line_total_snapshot ?? $this->amount;
    }

    public function invoice()
    {
        return $this->belongsTo(Invoice::class);
    }

    public function service()
    {
        return $this->belongsTo(Service::class);
    }

    public function inventory()
    {
        return $this->belongsTo(Inventory::class, 'inventory_id');
    }

    public function parent()
    {
        return $this->belongsTo(InvoiceItem::class, 'parent_id');
    }

    public function children()
    {
        return $this->hasMany(InvoiceItem::class, 'parent_id');
    }
}
