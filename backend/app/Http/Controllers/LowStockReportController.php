<?php

namespace App\Http\Controllers;

use App\Models\Inventory;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Response;

class LowStockReportController extends Controller
{
    public function generate(Request $request)
    {
        $lowStockItems = Inventory::whereRaw('stock_level <= min_stock_level')
            ->orderBy('stock_level', 'asc')
            ->get();

        if ($request->query('format') === 'csv') {
            $csvHeader = "Item Name,SKU,Category,Current Stock,Min Stock Level,Supplier,Expiration Date\n";
            $csvRows = $lowStockItems->map(function ($item) {
                return implode(',', [
                    "\"{$item->item_name}\"",
                    $item->sku,
                    $item->category,
                    $item->stock_level,
                    $item->min_stock_level,
                    "\"{$item->supplier}\"",
                    $item->expiration_date,
                ]);
            })->implode("\n");

            return Response::make($csvHeader . $csvRows, 200, [
                'Content-Type'        => 'text/csv',
                'Content-Disposition' => 'attachment; filename="low_stock_report_' . now()->format('Y-m-d') . '.csv"',
            ]);
        }

        return response()->json([
            'generated_at' => now()->toIso8601String(),
            'total_items'  => $lowStockItems->count(),
            'items'        => $lowStockItems,
        ]);
    }
}
