<?php

namespace App\Http\Controllers;

use App\Models\Inventory;
use App\Services\InventoryForecastService;
use Illuminate\Http\Request;
use Illuminate\Http\JsonResponse;

class InventoryForecastController extends Controller
{
    protected $inventoryForecastService;

    public function __construct(InventoryForecastService $inventoryForecastService)
    {
        $this->inventoryForecastService = $inventoryForecastService;
    }

    /**
     * Get inventory stockout forecast for a specific inventory item.
     *
     * @param  \Illuminate\Http\Request  $request
     * @param  \App\Models\Inventory  $inventory
     * @return \Illuminate\Http\JsonResponse
     */
    public function forecast(Request $request, Inventory $inventory): JsonResponse
    {
        // Validate request, e.g., ensure history_days is an integer
        $request->validate([
            'history_days' => 'sometimes|integer|min:7|max:365',
        ]);

        $historyDays = $request->query('history_days', 30);

        $forecast = $this->inventoryForecastService->getStockoutForecast(
            $inventory->id,
            $historyDays
        );

        $transactionCount = \App\Models\InventoryTransaction::where('inventory_id', $inventory->id)->where('created_at', '>=', \Carbon\Carbon::now()->subDays($historyDays))->count();
        $invoiceItemCount = \App\Models\InvoiceItem::where('inventory_id', $inventory->id)->whereHas('invoice', function($q) use($historyDays) { $q->realized()->where('created_at', '>=', \Carbon\Carbon::now()->subDays($historyDays)); })->count();
        $totalRecords = $transactionCount + $invoiceItemCount;

        $label_mode = "ai";
        $confidence_note = "";
        $interpretation = "";
        $recommendations = [];

        $days = $forecast['days_until_stockout'] ?? null;
        // Strict Python output mapping rule enforcement: Catch null, nan, negatives, script errors or empty sets
        $invalid = isset($forecast['error']) || (is_numeric($days) && ($days < 0 || is_nan($days))) || (!isset($forecast['predicted_stockout_date'])) || ($totalRecords < 2);

        if ($invalid) {
            $label_mode = "overview";
            $confidence_note = "Forecast unavailable: insufficient historical data ({$totalRecords} records max). Minimum 2 required.";
            $forecastData = [
                'predicted_stockout_date' => 'Unavailable',
                'recommended_stock' => $inventory->min_stock_level ?? 0,
                'message' => $forecast['error'] ?? 'Unstable or missing historical data.'
            ];
        } else {
            if ($totalRecords > 10) {
                 $confidence_note = "Forecast generated from {$totalRecords} combined records over {$historyDays} days. Reliable predictive sequence.";
            } else {
                 $confidence_note = "Forecast generated from {$totalRecords} combined records over {$historyDays} days. Limited accuracy due to small dataset.";
            }

            // Recommendation Engine (STRICT RULE-BASED) using derived python variables appropriately
            $daily_usage = isset($forecast['slope']) ? abs((float)$forecast['slope']) : 0;
            $reorder_level = $inventory->min_stock_level ?? 0;
            $lead_time_days = $inventory->lead_time_days ?? 7; 

            if ($daily_usage > 0) {
                $recommended_stock = ceil($reorder_level + ($daily_usage * $lead_time_days));
            } else {
                $recommended_stock = $reorder_level;
            }

            if (!is_null($days) && $days <= 14) {
                 $recommendations[] = "Prepare inventory for continued demand. Reorder approximately {$recommended_stock} units.";
                 $interpretation = "Linear regression estimates stock depletion in {$days} days at an average rate of " . number_format($daily_usage, 1) . " units/day.";
            } else {
                 $interpretation = "Stock depletion trend is stable based on continuous consumption calculations.";
                 $recommendations[] = "No immediate ordering required based on AI projection.";
            }

            if ($inventory->stock_level <= $reorder_level && $inventory->stock_level > 0) {
                 $recommendations[] = "Restock recommended (at or below reorder level).";
            }
            if ($inventory->stock_level <= 0) {
                 $recommendations[] = "Out of stock – immediate action required.";
            }

            $forecastData = [
                'predicted_stockout_date' => $forecast['predicted_stockout_date'] ?? 'Stable',
                'recommended_stock' => $recommended_stock,
                'message' => $forecast['message'] ?? 'Forecast calculated successfully.'
            ];
        }

        return response()->json([
            'success' => true,
            'label_mode' => $label_mode,
            'data' => $forecastData,
            'interpretation' => $interpretation,
            'recommendations' => $recommendations,
            'data_basis' => "AI linear regression utilizing up to {$historyDays} days of consumption history.",
            'confidence_note' => $confidence_note
        ]);
    }
}
