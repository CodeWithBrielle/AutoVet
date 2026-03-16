<?php

namespace App\Listeners;

use App\Events\LowStockDetected;
use Illuminate\Support\Facades\Log;

class SendLowStockNotification
{
    public function handle(LowStockDetected $event): void
    {
        $item = $event->inventory;
        Log::warning("LOW STOCK ALERT: '{$item->item_name}' (SKU: {$item->sku}) is critically low. Current stock: {$item->stock_level}, Minimum: {$item->min_stock_level}.");
        // TODO: Extend this to send an email or push notification
    }
}
