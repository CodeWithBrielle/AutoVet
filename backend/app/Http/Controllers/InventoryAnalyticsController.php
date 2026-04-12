<?php

namespace App\Http\Controllers;

use App\Models\Inventory;
use App\Models\InventoryTransaction;
use App\Models\InvoiceItem;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Carbon\Carbon;

class InventoryAnalyticsController extends Controller
{
    /**
     * Get a high-level summary of inventory health.
     */
    public function getSummary()
    {
        $totalItems = Inventory::count();
        $outOfStock = Inventory::outOfStock()->count();
        $lowStock = Inventory::lowStock()->count();
        $expiringSoon = Inventory::expiringSoon()->count();

        $totalValue = Inventory::sum(DB::raw('stock_level * cost_price'));

        return response()->json([
            'total_items' => $totalItems,
            'out_of_stock' => $outOfStock,
            'low_stock' => $lowStock,
            'expiring_soon' => $expiringSoon,
            'total_value' => round($totalValue, 2)
        ]);
    }

    /**
     * Get a list of top moving (consumed) inventory items.
     */
    public function getTopMoving()
    {
        // Calculate usage from both transactions (Adjustment Out, etc) and Invoice Items
        $topItems = InvoiceItem::with('inventory:id,item_name,sku')
            ->select('inventory_id', DB::raw('SUM(qty) as total_quantity'))
            ->whereNotNull('inventory_id')
            ->groupBy('inventory_id')
            ->orderBy('total_quantity', 'desc')
            ->limit(5)
            ->get();

        return response()->json($topItems);
    }

    /**
     * Get recent inventory transactions for a movement summary.
     */
    public function getRecentMovements()
    {
        $movements = InventoryTransaction::with(['inventory:id,item_name,sku', 'creator:id,name'])
            ->orderBy('created_at', 'desc')
            ->limit(5)
            ->get();

        return response()->json($movements);
    }

    /**
     * Get items that are expiring within the next 30 days.
     */
    public function getExpiringSoon()
    {
        $items = Inventory::expiringSoon()
            ->orderBy('expiration_date', 'asc')
            ->limit(5)
            ->get();

        return response()->json($items);
    }
}
