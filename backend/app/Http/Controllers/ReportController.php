<?php

namespace App\Http\Controllers;

use Illuminate\Http\Request;

class ReportController extends Controller
{
    public function dashboardStats()
    {
        // 1. Monthly Revenue (Last 6 months)
        $monthlyRevenue = \App\Models\Invoice::whereIn('status', ['Finalized', 'Paid'])
            ->selectRaw('DATE_FORMAT(created_at, "%Y-%m") as month, SUM(total) as revenue')
            ->groupBy('month')
            ->orderBy('month', 'asc')
            ->take(6)
            ->get();

        // 2. Top Selling Products
        $topProducts = \App\Models\InvoiceItem::selectRaw('name, SUM(qty) as total_sold')
            ->groupBy('name')
            ->orderBy('total_sold', 'desc')
            ->take(5)
            ->get();

        $stats = [
            'monthly_revenue' => $monthlyRevenue,
            'top_products' => $topProducts,
            'appointment_count' => \App\Models\Appointment::whereDate('date', '>=', now()->startOfMonth())->count(),
        ];

        return response()->json(['status' => 'success', 'data' => $stats]);
    }

    public function salesForecast()
    {
        // Fetch real historical monthly revenue
        $historical = \App\Models\Invoice::whereIn('status', ['Paid', 'Finalized'])
            ->selectRaw('DATE_FORMAT(created_at, "%b") as month, SUM(total) as actual')
            ->groupBy('month')
            ->orderByRaw('MIN(created_at) asc')
            ->get()
            ->toArray();

        // Calculate generic Moving Average (e.g., 3-Month MA) for forecast
        $forecastData = [];
        foreach ($historical as $index => $data) {
            $forecast = null;
            if ($index >= 3) {
                 $avg = ($historical[$index-1]['actual'] + $historical[$index-2]['actual'] + $historical[$index-3]['actual']) / 3;
                 $forecast = round($avg, 2);
            }
            $forecastData[] = [
                'month' => $data['month'],
                'actual' => (float)$data['actual'],
                'forecast' => $forecast
            ];
        }
        
        // Project next month
        $lastThree = array_slice($historical, -3);
        if (count($lastThree) === 3) {
            $nextMonthAvg = array_sum(array_column($lastThree, 'actual')) / 3;
            $forecastData[] = [
                'month' => now()->addMonth()->format('M'),
                'actual' => null,
                'forecast' => round($nextMonthAvg, 2)
            ];
        }

        return response()->json(['status' => 'success', 'data' => $forecastData]);
    }
}
