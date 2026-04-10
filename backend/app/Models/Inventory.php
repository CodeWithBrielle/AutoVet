<?php

namespace App\Models;

use App\Traits\Archivable;
use App\Traits\HasSyncFields;
use App\Traits\HasAuditTrail;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\SoftDeletes;
use Illuminate\Support\Facades\DB;

class Inventory extends Model
{
    use SoftDeletes, HasSyncFields, Archivable, HasAuditTrail;
    protected $fillable = [
        'item_name',
        'sub_details',
        'inventory_category_id',
        'sku',
        'stock_level',
        'status',
        'cost_price',
        'selling_price',
        'service_price',
        'supplier',
        'expiration_date',
        'min_stock_level',
        'is_sellable',
        'is_service_usable',
        'deduct_on_finalize',
        // Archive tracking
        'deleted_by', 'restore_until',
        // Sync fields
        'uuid', 'sync_status', 'synced_at', 'last_modified_locally_at',
    ];

    protected $casts = [
        'cost_price'               => 'decimal:2',
        'selling_price'            => 'decimal:2',
        'service_price'            => 'decimal:2',
        'is_sellable'              => 'boolean',
        'is_service_usable'        => 'boolean',
        'deduct_on_finalize'       => 'boolean',
        'expiration_date'          => 'date',
        'synced_at'                => 'datetime',
        'last_modified_locally_at' => 'datetime',
    ];

    public function transactions()
    {
        return $this->hasMany(InventoryTransaction::class);
    }

    public function inventoryCategory()
    {
        return $this->belongsTo(InventoryCategory::class, 'inventory_category_id');
    }

    /**
     * Determine if this inventory item has only its auto-created initial stock transaction.
     */
    public function hasOnlyInitialStockTransaction(): bool
    {
        $count = $this->transactions()->count();
        if ($count === 0) return true;
        if ($count > 1) return false;
        
        $tx = $this->transactions()->first();
        return $tx->transaction_type === 'Stock In' && $tx->remarks === 'Initial Stock';
    }

    public function preventPermanentDeletionIfReferenced()
    {
        if (DB::table('invoice_items')->where('inventory_id', $this->id)->exists()) {
            throw new \Exception("Cannot permanently delete this inventory item because it is referenced in past invoices.");
        }
        
        if (!$this->hasOnlyInitialStockTransaction()) {
            throw new \Exception("This item cannot be permanently deleted because it already has inventory activity beyond its initial stock entry.");
        }
    }

    /**
     * Scope for Out of Stock items.
     */
    public function scopeOutOfStock($query)
    {
        return $query->where('stock_level', '<=', 0);
    }

    /**
     * Scope for Low Stock items (Inclusive of Out of Stock).
     */
    public function scopeLowStock($query)
    {
        return $query->whereColumn('stock_level', '<=', 'min_stock_level');
    }

    /**
     * Scope for Critical Stock items (Inclusive of Out of Stock).
     */
    public function scopeCriticalStock($query)
    {
        return $query->whereRaw('stock_level <= (min_stock_level * 0.25)');
    }

    /**
     * Scope for Expiring Soon items (within next 30 days).
     */
    public function scopeExpiringSoon($query)
    {
        return $query->whereDate('expiration_date', '>=', now())
            ->whereDate('expiration_date', '<=', now()->addDays(30));
    }
}
