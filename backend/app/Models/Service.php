<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class Service extends Model
{
    protected $fillable = [
        'name',
        'description',
        'price',
<<<<<<< Updated upstream
        'category',
        'status',
    ];
=======
        'pricing_mode',
        'category_id',
        'category',
        'status',
    ];

    public function sizePrices()
    {
        return $this->hasMany(ServicePrice::class);
    }

    public function category()
    {
        return $this->belongsTo(ServiceCategory::class, 'category_id');
    }
>>>>>>> Stashed changes
}
