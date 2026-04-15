<?php

namespace App\Listeners;

use App\Events\LowStockDetected;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Queue\InteractsWithQueue;
use Illuminate\Support\Facades\Log;

class SendLowStockNotification
{
    protected $clientNotificationService;

    public function __construct(\App\Services\ClientNotificationService $clientNotificationService)
    {
        $this->clientNotificationService = $clientNotificationService;
    }

    /**
     * Handle the event.
     */
    public function handle(LowStockDetected $event): void
    {
        $item = $event->inventoryItem;
        
        // 1. Create In-App Notification (Legacy)
        \App\Models\Notification::create([
            'type' => 'LowStockAlert',
            'title' => 'Low Stock Alert',
            'message' => "{$item->item_name} (SKU: {$item->sku}) has reached {$item->stock_level} (Threshold: {$item->min_stock_level})",
            'data' => [
                'inventory_id' => $item->id,
                'stock_level' => $item->stock_level,
                'min_stock_level' => $item->min_stock_level,
            ]
        ]);

        // 2. Trigger Internal Audited Email
        $admin = \App\Models\User::where('role', 'admin')->first();
        if ($admin && $admin->email) {
            // Find or create a 'System' owner for internal logging, 
            // OR we can allow null owner_id in the service if we update it.
            // For now, let's just find the first owner record as a proxy or skip formal client_log.
            
            // Re-evaluating: The plan said "Low stock = internal alert". 
            // My service sendInternalAlert is designed for this.
            $this->clientNotificationService->sendInternalAlert(
                'internal_low_stock',
                "Low stock detected for {$item->item_name}.",
                "Low Stock Alert",
                ['email']
            );
        }
    }
}
