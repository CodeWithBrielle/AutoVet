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

        $revenue = Invoice::realized()
            ->where('created_at', '>=', $startDate)
            ->select(
                DB::raw('DATE(created_at) as date'),
                DB::raw('SUM(total) as total')
            )
            ->groupBy('date')
            ->orderBy('date')
            ->get();

        return response()->json($revenue);
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

        return response()->json($topServices);
    }

    /**
     * Get daily transaction volume.
     */
    public function getTransactionVolume(Request $request)
    {
        $days = $request->query('days', 7);
        $startDate = Carbon::now()->subDays($days);

        $volume = Invoice::realized()
            ->where('created_at', '>=', $startDate)
            ->select(
                DB::raw('DATE(created_at) as date'),
                DB::raw('COUNT(*) as count')
            )
            ->groupBy('date')
            ->orderBy('date')
            ->get();

        return response()->json($volume);
    }
}
