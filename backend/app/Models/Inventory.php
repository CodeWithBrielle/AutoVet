<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class Inventory extends Model
{
    protected $fillable = [
        'item_name',
        'sub_details',
        'category_id',
        'category', // Keep for now for compatibility or data migration
        'sku',
        'stock_level',
        'status',
        'price',
        'supplier',
        'expiration_date'
    ];
<<<<<<< Updated upstream
=======

    protected $casts = [
        'price' => 'decimal:2',
        'selling_price' => 'decimal:2',
        'is_billable' => 'boolean',
        'is_consumable' => 'boolean',
        'deduct_on_finalize' => 'boolean',
        'expiration_date' => 'date',
    ];

    public function transactions()
    {
        return $this->hasMany(InventoryTransaction::class);
    }

    public function category()
    {
        return $this->belongsTo(InventoryCategory::class, 'category_id');
    }
>>>>>>> Stashed changes
}
