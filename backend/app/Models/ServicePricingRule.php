<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class ServicePricingRule extends Model
{
    protected $fillable = [
        'service_id', 'basis_type', 'reference_id', 'price',
        'species_id', 'breed_id', 'size_category_id', 'min_weight', 'max_weight'
    ];

    public function service()
    {
        return $this->belongsTo(Service::class);
    }
}
