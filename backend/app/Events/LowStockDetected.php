<?php

namespace App\Events;

use App\Models\Inventory;
use Illuminate\Foundation\Events\Dispatchable;
use Illuminate\Queue\SerializesModels;

class LowStockDetected
{
    use Dispatchable, SerializesModels;

    public Inventory $inventory;

    public function __construct(Inventory $inventory)
    {
        $this->inventory = $inventory;
    }
}
