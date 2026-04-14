<?php

namespace App\Http\Controllers;

use App\Models\Invoice;
use App\Models\InvoiceItem;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Carbon\Carbon;

class SalesReportController extends Controller
{
    /**
     * Get revenue data for charts and summaries.
     */
    public function getRevenueSummary(Request $request)
    {
        $days = $request->query('days', 30);
        $startDate = Carbon::now()->subDays($days);

        $prevStartDate = Carbon::now()->subDays($days * 2);

        $currentRevenue = Invoice::realized()
            ->where('created_at', '>=', $startDate)
            ->sum('total');

        $prevRevenue = Invoice::realized()
            ->whereBetween('created_at', [$prevStartDate, $startDate])
            ->sum('total');

        $revenue = Invoice::realized()
            ->where('created_at', '>=', $startDate)
            ->select(
                DB::raw('DATE(created_at) as date'),
                DB::raw('SUM(total) as total')
            )
            ->groupBy('date')
            ->orderBy('date')
            ->get();

        $label_mode = 'overview';
        $interpretation = "";
        $recommendations = [];
        $confidence_note = "";

        if ($currentRevenue > 0 || $prevRevenue > 0) {
            $percentChange = null;
            if ($prevRevenue > 0) {
                $percentChange = (($currentRevenue - $prevRevenue) / $prevRevenue) * 100;
            }
            
            if (is_null($percentChange)) {
                $interpretation = "Over the last {$days} days, realized revenue was generated, but no prior period data exists for comparison.";
            } else {
                $trend = $percentChange >= 0 ? "an upward pattern" : "a downward pattern";
                $interpretation = "Over the last {$days} days, realized revenue showed {$trend}, changing by " . abs(round($percentChange, 1)) . "% compared to the prior {$days} days.";
            }
            
            if (!is_null($percentChange)) {
                if ($percentChange < -10) {
                    $recommendations[] = "Revenue has notably declined. Consider reviewing recent appointment volumes or following up on outstanding estimates.";
                } elseif ($percentChange > 10) {
                    $recommendations[] = "Solid revenue pattern detected. Maintain targeted service availability.";
                }
            }
        } else {
            $interpretation = "";
            $confidence_note = "Insufficient historical data for forecasting.";
        }

        return response()->json([
            'success' => true,
            'label_mode' => $label_mode,
            'data' => $revenue,
            'interpretation' => $interpretation,
            'recommendations' => $recommendations,
            'notable_findings' => [],
            'data_basis' => "Comparing current {$days} days vs previous {$days} days. Includes only realized invoices.",
            'confidence_note' => $confidence_note
        ]);
    }

    /**
     * Get top services by revenue or frequency.
     */
    public function getTopServices(Request $request)
    {
        $limit = $request->query('limit', 5);

        $topServices = InvoiceItem::whereHas('invoice', function ($query) {
                $query->realized();
            })
            ->whereNotNull('service_id')
            ->select(
                'service_id',
                'name as item_name',
                DB::raw('COUNT(*) as total_count'),
                DB::raw('SUM(COALESCE(line_total_snapshot, amount)) as total_revenue')
            )
            ->groupBy('service_id', 'name')
            ->orderBy('total_revenue', 'desc')
            ->limit($limit)
            ->get();

        $label_mode = 'overview';
        $interpretation = "";
        $recommendations = [];
        $confidence_note = "";

        if ($topServices->count() > 0) {
            $topItem = $topServices->first();
            $interpretation = "The most significant revenue driver is currently '{$topItem->item_name}', generating {$topItem->total_count} transactions.";
            
            if ($topItem->total_count > 10) {
                $recommendations[] = "High volume for '{$topItem->item_name}' indicates strong demand. Ensure adequate staffing to support it.";
            }
        } else {
            $interpretation = "";
            $confidence_note = "Insufficient historical data to determine top services.";
        }

        return response()->json([
            'success' => true,
            'label_mode' => $label_mode,
            'data' => $topServices,
            'interpretation' => $interpretation,
            'recommendations' => $recommendations,
            'notable_findings' => [],
            'data_basis' => "Aggregating all realized invoice items. Ranked by total revenue.",
            'confidence_note' => $confidence_note
        ]);
    }

    /**
     * Get daily transaction volume.
     */
    public function getTransactionVolume(Request $request)
    {
        $days = $request->query('days', 7);
        $startDate = Carbon::now()->subDays($days);

        $prevStartDate = Carbon::now()->subDays($days * 2);

        $currentVolume = Invoice::realized()
            ->where('created_at', '>=', $startDate)
            ->count();

        $prevVolume = Invoice::realized()
            ->whereBetween('created_at', [$prevStartDate, $startDate])
            ->count();

        $volume = Invoice::realized()
            ->where('created_at', '>=', $startDate)
            ->select(
                DB::raw('DATE(created_at) as date'),
                DB::raw('COUNT(*) as count')
            )
            ->groupBy('date')
            ->orderBy('date')
            ->get();

        $label_mode = 'overview';
        $interpretation = "";
        $recommendations = [];
        $confidence_note = "";

        if ($currentVolume > 0 || $prevVolume > 0) {
            $percentChange = null;
            if ($prevVolume > 0) {
                $percentChange = (($currentVolume - $prevVolume) / $prevVolume) * 100;
            }
            
            if (is_null($percentChange)) {
                $interpretation = "Transaction volume observed over the last {$days} days, without prior period comparison.";
            } else {
                $trend = $percentChange >= 0 ? "an increase" : "a decrease";
                $interpretation = "Transaction volume shows {$trend} of " . abs(round($percentChange, 1)) . "% over the last {$days} days compared to the prior {$days} days.";
            }
        } else {
            $interpretation = "";
            $confidence_note = "Insufficient historical data for forecasting.";
        }

        return response()->json([
            'success' => true,
            'label_mode' => $label_mode,
            'data' => $volume,
            'interpretation' => $interpretation,
            'recommendations' => $recommendations,
            'notable_findings' => [],
            'data_basis' => "Comparing transaction counts for realized invoices over trailing {$days} days.",
            'confidence_note' => $confidence_note
        ]);
    }
}
