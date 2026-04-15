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

        $label_mode = 'overview';
        $interpretation = "";
        $recommendations = [];
        $confidence_note = "";

        if ($outOfStock > 0 || $lowStock > 0 || $expiringSoon > 0) {
            $interpretation = "Currently tracking {$totalItems} distinct items. Stock warnings detected.";
            
            if ($outOfStock > 0) {
                $recommendations[] = "{$outOfStock} items are totally out of stock. Prioritize reordering today to avoid service disruptions.";
            }
            if ($lowStock > 0) {
                $recommendations[] = "{$lowStock} items are dropping below minimum levels. Prepare a purchase order for these lines.";
            }
            if ($expiringSoon > 0) {
                $recommendations[] = "{$expiringSoon} items are expiring soon. Consider discounting or returning to supplier.";
            }
        } else {
            $interpretation = "Currently tracking {$totalItems} distinct items with healthy stock levels.";
        }

        return response()->json([
            'success' => true,
            'label_mode' => $label_mode,
            'data' => [
                'total_items' => $totalItems,
                'out_of_stock' => $outOfStock,
                'low_stock' => $lowStock,
                'expiring_soon' => $expiringSoon,
                'total_value' => round($totalValue, 2)
            ],
            'interpretation' => $interpretation,
            'recommendations' => $recommendations,
            'notable_findings' => [],
            'data_basis' => "Aggregated counts from current active inventory records.",
            'confidence_note' => $confidence_note
        ]);
    }

    /**
     * Get a list of top moving (consumed) inventory items.
     */
    public function getTopMoving()
    {
        $topItems = InvoiceItem::with('inventory:id,item_name,sku')
            ->whereHas('invoice', function ($query) {
                $query->realized();
            })
            ->select('inventory_id', DB::raw('SUM(qty) as total_quantity'))
            ->whereNotNull('inventory_id')
            ->groupBy('inventory_id')
            ->orderBy('total_quantity', 'desc')
            ->limit(5)
            ->get();

        return response()->json([
            'success' => true,
            'label_mode' => 'overview',
            'data' => $topItems,
            'interpretation' => "",
            'recommendations' => [],
            'notable_findings' => [],
            'data_basis' => "Top 5 consumed inventory items extracted from realized invoices.",
            'confidence_note' => ""
        ]);
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

        return response()->json([
            'success' => true,
            'label_mode' => 'overview',
            'data' => $movements,
            'interpretation' => "",
            'recommendations' => [],
            'notable_findings' => [],
            'data_basis' => "Latest 5 inventory transactions.",
            'confidence_note' => ""
        ]);
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

        return response()->json([
            'success' => true,
            'label_mode' => 'overview',
            'data' => $items,
            'interpretation' => "",
            'recommendations' => [],
            'notable_findings' => [],
            'data_basis' => "Items reaching expiration within next 30 days.",
            'confidence_note' => ""
        ]);
    }
}
