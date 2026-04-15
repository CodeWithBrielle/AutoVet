<?php

namespace App\Http\Controllers;

use App\Models\Invoice;
use App\Models\Pet;
use App\Models\Appointment;
use App\Models\Inventory;
use App\Models\InvoiceItem;
use Carbon\Carbon;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class DashboardController extends Controller
{
    /**
     * Get detailed AI analysis for a specific inventory item or general stock.
     */
    public function getInventoryForecast()
    {
        $item = Inventory::orderByRaw('(stock_level - min_stock_level) ASC')->first();

        if (!$item) {
            return response()->json(['message' => 'No inventory items found.'], 404);
        }

        $monthsToFetch = 6;
        $timeline = [];
        $now = Carbon::now()->startOfMonth();
        $startMonth = $now->copy()->subMonths($monthsToFetch - 1);
        
        for ($i = 0; $i < $monthsToFetch; $i++) {
            $timeline[] = ['date' => $startMonth->copy()->addMonths($i)];
        }

        $usageRecords = InvoiceItem::whereHas('invoice', function($q) {
                $q->whereIn('status', ['Finalized', 'Paid', 'Partially Paid']);
            })
            ->where('inventory_id', $item->id)
            ->where('created_at', '>=', $startMonth)
            ->select(
                DB::raw('YEAR(created_at) as year'),
                DB::raw('MONTH(created_at) as month'),
                DB::raw('SUM(qty) as total_qty')
            )
            ->groupBy('year', 'month')
            ->get();

        $actualData = [];
        foreach ($usageRecords as $u) {
            $key = $u->year . '-' . str_pad($u->month, 2, '0', STR_PAD_LEFT);
            $actualData[$key] = (float) $u->total_qty;
        }

        $months = [];
        $usage = [];
        
        $xValues = [];
        $yValues = [];

        foreach ($timeline as $index => $t) {
            $key = $t['date']->format('Y-m');
            $months[] = $t['date']->format('M');
            
            $val = $actualData[$key] ?? 0;
            $usage[] = $val;
            
            $xValues[] = $index;
            $yValues[] = $val;
        }

        // Simple Linear Regression
        $n = count($xValues);
        $m = 0; $b = 0;
        if ($n > 1) {
            $sumX = array_sum($xValues);
            $sumY = array_sum($yValues);
            $sumXY = $sumX2 = 0;
            for ($i = 0; $i < $n; $i++) {
                $sumXY += ($xValues[$i] * $yValues[$i]);
                $sumX2 += ($xValues[$i] * $xValues[$i]);
            }
            $denominator = ($n * $sumX2) - ($sumX * $sumX);
            $m = ($denominator != 0) ? (($n * $sumXY) - ($sumX * $sumY)) / $denominator : 0;
            $b = ($n != 0) ? ($sumY - ($m * $sumX)) / $n : 0;
        } elseif ($n == 1) {
            $b = $yValues[0];
        }

        $forecast = max(0, round(($m * $n) + $b, 1));
        $months[] = $now->copy()->addMonths(1)->format('M');

        $growth = 0;
        if (count($usage) >= 2) {
            $lastIndex = count($usage) - 1;
            $prev = $usage[$lastIndex - 1];
            $curr = $usage[$lastIndex];
            if ($prev > 0) {
                $growth = (($curr - $prev) / $prev) * 100;
            }
        }
        $growthLabel = ($growth != 0 ? ($growth >= 0 ? '+' : '') . round($growth, 1) . '% vs last month' : 'No change');

        $stockoutWarning = '';
        if ($item->stock_level < $forecast && $forecast > 0) {
            $daysLeft = max(1, round(($item->stock_level / $forecast) * 30));
            $stockoutWarning = " Based on the next month's forecasted usage of {$forecast} units, {$item->item_name} is projected to run out in approximately {$daysLeft} days.";
        } else {
            $stockoutWarning = $forecast > 0 
                ? " Current stock level is sufficient to meet the forecasted usage of {$forecast} units for next month."
                : " Insufficient historical data to project specific stockout risk.";
        }

        return response()->json([
            'item_name' => $item->item_name,
            'recommended_stock' => $item->min_stock_level * 2,
            'current_stock' => $item->stock_level,
            'growth_label' => $growthLabel,
            'analysis' => ($n >= 2 ? "Analyzed the last {$n} months of sales data." : "Monitoring initial sales data.") . $stockoutWarning,
            'chart_data' => [
                'months' => $months,
                'usage' => $usage,
                'forecast' => $forecast
            ]
        ]);
    }

    /**
     * Get AI planning hints for appointments with peak detection.
     */
    public function getAppointmentForecast()
    {
        $last7Days = Appointment::whereBetween('date', [now()->subDays(7)->toDateString(), now()->toDateString()])->count();
        $next7Days = Appointment::whereBetween('date', [now()->addDay()->toDateString(), now()->addDays(8)->toDateString()])->count();

        $percentChange = $last7Days > 0 ? (($next7Days - $last7Days) / $last7Days) * 100 : ($next7Days > 0 ? 100 : 0);
        $trendDirection = $next7Days >= $last7Days ? 'increase' : 'decrease';

        // Peak Day Detection
        $peakDayQuery = Appointment::select(DB::raw('DAYNAME(date) as day_name'), DB::raw('COUNT(*) as count'))
            ->groupBy('day_name')
            ->orderBy('count', 'desc')
            ->first();
        $peakDay = $peakDayQuery ? $peakDayQuery->day_name : 'N/A';

        // Busiest Hours Detection
        $peakHourQuery = Appointment::select(DB::raw('HOUR(time) as hour'), DB::raw('COUNT(*) as count'))
            ->groupBy('hour')
            ->orderBy('count', 'desc')
            ->first();
        $peakHour = $peakHourQuery ? $peakHourQuery->hour : null;

        $peakHourLabel = 'N/A';
        if ($peakHour !== null) {
            if ($peakHour == 0) $peakHourLabel = "12 AM";
            elseif ($peakHour == 12) $peakHourLabel = "12 PM";
            elseif ($peakHour > 12) $peakHourLabel = ($peakHour - 12) . " PM";
            else $peakHourLabel = $peakHour . " AM";
        }

        $interpretation = "";
        $label_mode = 'overview';
        $recommendations = [];
        $confidence_note = "";

        $recordCount = $last7Days + $next7Days;
        $pastAppts = Appointment::whereNotIn('status', ['Cancelled', 'No Show'])
             ->where('date', '>=', now()->subDays(14))
             ->where('date', '<', now()->toDateString())
             ->count();

        if ($recordCount < 2) {
             $label_mode = "overview";
             $interpretation = "";
             $recommendations = [];
             $confidence_note = "Forecast unavailable: insufficient historical data ({$pastAppts} records max).";
        } else {
            $label_mode = 'ai';
            $interpretation = "A " . abs(round($percentChange)) . "% " . $trendDirection . " trend in appointments is expected next week relative to the trailing 7 days. ";
            if ($peakDay !== 'N/A') {
                $interpretation .= "Historical pattern shows " . $peakDay . "s are your busiest days, with a peak around " . $peakHourLabel . ".";
            }

            if ($next7Days > ($last7Days * 1.2)) {
                $recommendations[] = "Appointment volume is rising. Consider adding a relief vet or extending morning hours.";
            }
            if ($peakDay !== 'N/A') {
                $recommendations[] = "Ensure full staffing on " . $peakDay . "s to handle the historical peak volume.";
            }
            if ($pastAppts > 20) {
                $confidence_note = "Forecast generated from {$pastAppts} records over 14 days. Reliable confidence based on stable dataset.";
            } else {
                $confidence_note = "Forecast generated from {$pastAppts} records over 14 days. Limited accuracy due to small dataset.";
            }
        }

        $overdueFollowups = \App\Models\MedicalRecord::whereNotNull('follow_up_date')
            ->where('follow_up_date', '<', now()->toDateString())
            ->whereHas('appointment', function($q) { $q->whereNotIn('status', ['Cancelled', 'No Show']); })
            ->count();
        if ($overdueFollowups > 5) {
            $recommendations[] = "You have {$overdueFollowups} overdue follow-ups. Assign staff to call owners during slow hours.";
        }

        if (empty($recommendations) && $label_mode === 'ai') {
            $recommendations[] = "Maintain current staffing levels. Operations generally align with recent patterns.";
        }

        return response()->json([
            'success' => true,
            'label_mode' => $label_mode,
            'data' => [
                'next_7_days' => $next7Days,
                'last_7_days' => $last7Days,
                'peak_day' => $peakDay,
                'peak_hour' => $peakHourLabel,
                'trend_direction' => $trendDirection
            ],
            'interpretation' => $interpretation,
            'recommendations' => $recommendations,
            'anomaly' => [
                'detected' => false,
                'explanation' => ''
            ],
            'data_basis' => "Comparing past 7 days vs next 7 days, bounded to local timezone. Excludes cancelled/no-show statuses.",
            'confidence_note' => $confidence_note,
            'notable_findings' => ($label_mode === 'ai' && abs($percentChange) > 40 && $recordCount > 5) ? ["Unexpected " . abs(round($percentChange)) . "% swing in booking volume detected."] : []
        ]);
    }


    /**
     * Get overall dashboard statistics.
     */
    public function getStats()
    {
        $totalPets = Pet::count();
        $totalOwners = \App\Models\Owner::count();
        $monthlyRevenue = Invoice::realized()
            ->whereMonth('created_at', now()->month)
            ->whereYear('created_at', now()->year)
            ->sum('total');
        
        $pendingAppointments = Appointment::where('date', '>=', now()->toDateString())->count();
        
        // Low stock count (inclusive alert)
        $lowStockItems = Inventory::lowStock()->count();

        // Calculate revenue growth
        $lastMonthRevenue = Invoice::realized()
            ->whereMonth('created_at', now()->subMonth()->month)
            ->whereYear('created_at', now()->subMonth()->year)
            ->sum('total');
        
        $revenueGrowth = 0;
        if ($lastMonthRevenue > 0) {
            $revenueGrowth = (($monthlyRevenue - $lastMonthRevenue) / $lastMonthRevenue) * 100;
        }

        $newPetsThisWeek = Pet::whereDate('created_at', '>=', now()->subDays(7))->count();
        $newClientsThisWeek = \App\Models\Owner::whereDate('created_at', '>=', now()->subDays(7))->count();
        $appointmentsToday = Appointment::whereDate('date', now()->toDateString())->count();

        return response()->json([
            [
                'id' => 'stat-1',
                'title' => 'Total Pets',
                'value' => number_format($totalPets),
                'detail' => 'Active pets in care',
                'iconName' => 'FiHeart',
                'iconBg' => 'bg-blue-100 dark:bg-blue-900/30',
                'iconColor' => 'text-blue-600 dark:text-blue-400',
                'badge' => '+' . $newPetsThisWeek . ' this week',
                'badgeTone' => 'success',
            ],
            [
                'id' => 'stat-owners',
                'title' => 'Total Clients',
                'value' => number_format($totalOwners),
                'detail' => 'Registered pet owners',
                'iconName' => 'FiUsers',
                'iconBg' => 'bg-purple-100 dark:bg-purple-900/30',
                'iconColor' => 'text-purple-600 dark:text-purple-400',
                'badge' => '+' . $newClientsThisWeek . ' this week',
                'badgeTone' => 'success',
            ],
            [
                'id' => 'stat-2',
                'title' => 'Monthly Revenue',
                'value' => '₱' . number_format($monthlyRevenue, 0),
                'detail' => 'Realized income this month',
                'iconName' => 'FiDollarSign',
                'iconBg' => 'bg-emerald-100 dark:bg-emerald-900/30',
                'iconColor' => 'text-emerald-600 dark:text-emerald-400',
                'badge' => round($revenueGrowth, 1) . '% from last month',
                'badgeTone' => $revenueGrowth >= 0 ? 'success' : 'danger',
            ],
            [
                'id' => 'stat-3',
                'title' => 'Appointments',
                'value' => $pendingAppointments,
                'detail' => 'Upcoming scheduled visits',
                'iconName' => 'FiCalendar',
                'iconBg' => 'bg-indigo-100 dark:bg-indigo-900/30',
                'iconColor' => 'text-indigo-600 dark:text-indigo-400',
                'badge' => $appointmentsToday . ' today',
                'badgeTone' => 'info',
            ],
            [
                'id' => 'stat-4',
                'title' => 'Low Stock Alert',
                'value' => $lowStockItems,
                'detail' => 'Items below minimum level',
                'iconName' => 'FiAlertTriangle',
                'iconBg' => 'bg-rose-100 dark:bg-rose-900/30',
                'iconColor' => 'text-rose-600 dark:text-rose-400',
                'badge' => $lowStockItems > 0 ? 'Critical' : 'All Clear',
                'badgeTone' => $lowStockItems > 0 ? 'danger' : 'success',
                'accentBorder' => $lowStockItems > 0 ? 'border-l-4 border-l-rose-500' : '',
            ]
        ]);
    }

    /**
     * Get inventory consumption data with AI forecast and depletion analysis.
     */
    public function getInventoryConsumption(Request $request)
    {
        try {
            $rawRange = $request->query('range', '6_months');
            
            $rangeMap = [
                '1_month' => 1,
                '3_months' => 3,
                '6_months' => 6,
                '12_months' => 12,
                // Backward compatibility mapping
                '1 Month' => 1,
                '3 Months' => 3,
                '6 Months' => 6,
                '12 Months' => 12,
                'Year' => 12,
            ];

            if (!array_key_exists($rawRange, $rangeMap)) {
                return response()->json([
                    'success' => false,
                    'message' => 'Invalid range requested.'
                ], 422);
            }

            $monthsToFetch = $rangeMap[$rawRange];
            $futureMonths = 2;

        $timeline = [];
        $now = Carbon::now()->startOfMonth();
        $startMonth = $now->copy()->subMonths($monthsToFetch - 1);
        
        for ($i = 0; $i < $monthsToFetch; $i++) {
            $timeline[] = ['date' => $startMonth->copy()->addMonths($i), 'is_future' => false];
        }
        for ($i = 1; $i <= $futureMonths; $i++) {
            $timeline[] = ['date' => $now->copy()->addMonths($i), 'is_future' => true];
        }

        $usage = InvoiceItem::whereHas('invoice', function($q) {
                $q->realized();
            })
            ->select(
                DB::raw('YEAR(created_at) as year'),
                DB::raw('MONTH(created_at) as month'),
                DB::raw('SUM(qty) as total_qty')
            )
            ->where('created_at', '>=', $startMonth)
            ->groupBy('year', 'month')
            ->get();

        $actualData = [];
        foreach ($usage as $u) {
            $key = $u->year . '-' . str_pad($u->month, 2, '0', STR_PAD_LEFT);
            $actualData[$key] = (float) $u->total_qty;
        }

        $xValues = [];
        $yValues = [];
        foreach ($timeline as $index => $item) {
            if (!$item['is_future']) {
                $key = $item['date']->format('Y-m');
                $val = $actualData[$key] ?? 0;
                $xValues[] = $index;
                $yValues[] = $val;
            }
        }

        // Regression
        $n = count($xValues);
        $m = 0; $b = 0;
        if ($n > 1) {
            $sumX = array_sum($xValues);
            $sumY = array_sum($yValues);
            $sumXY = $sumX2 = 0;
            for ($i = 0; $i < $n; $i++) {
                $sumXY += ($xValues[$i] * $yValues[$i]);
                $sumX2 += ($xValues[$i] * $xValues[$i]);
            }
            $denominator = ($n * $sumX2) - ($sumX * $sumX);
            $m = ($denominator != 0) ? (($n * $sumXY) - ($sumX * $sumY)) / $denominator : 0;
            $b = ($n != 0) ? ($sumY - ($m * $sumX)) / $n : 0;
        } elseif ($n == 1) {
            $b = $yValues[0];
        }

        $chartResults = [];
        foreach ($timeline as $index => $item) {
            $forecastValue = max(0, ($m * $index) + $b);
            $key = $item['date']->format('Y-m');
            $chartResults[] = [
                'month' => $item['date']->format('M'),
                'actual' => $item['is_future'] ? null : ($actualData[$key] ?? 0),
                'forecast' => round($forecastValue, 1)
            ];
        }

        // --- Intelligence Layer ---
        $currentMonthKey = $now->format('Y-m');
        $currentVal = $actualData[$currentMonthKey] ?? 0;
        $prevMonthKey = $now->copy()->subMonth()->format('Y-m');
        $prevVal = $actualData[$prevMonthKey] ?? 0;
        
        $percentChange = null;
        if ($prevVal > 0) {
            $percentChange = (($currentVal - $prevVal) / $prevVal) * 100;
        }
        
        $label_mode = 'ai';
        $interpretation = "";
        $confidence_note = "";
        $recommendations = [];

        $inventoryRecords = InvoiceItem::whereHas('invoice', function($q) { $q->realized(); })
            ->where('created_at', '>=', now()->subMonths(12))
            ->count();

        if ($n < 2) {
            $label_mode = 'overview';
            $interpretation = "";
            $confidence_note = "Forecast unavailable: insufficient historical data ({$inventoryRecords} records). Minimum 2 months required.";
        } else {
            if (is_null($percentChange)) {
                 $interpretation = "No prior period data to establish a valid comparative trend.";
            } else {
                 $interpretation = "Inventory consumption exhibits a " . ($percentChange >= 0 ? "rising" : "declining") . " trend, changing by " . abs(round($percentChange, 1)) . "% this month compared to the previous month.";
            }
            if ($inventoryRecords > 50) {
                $confidence_note = "Forecast generated from {$inventoryRecords} consumption records over {$monthsToFetch} months. Reliable trend based on stable dataset.";
            } else {
                $confidence_note = "Forecast generated from {$inventoryRecords} consumption records over {$monthsToFetch} months. Limited accuracy due to small dataset.";
            }
        }

        // Anomaly Detection
        $notable_findings = [];
        $avgUsage = $n > 0 ? array_sum($yValues) / $n : 0;
        if ($avgUsage > 0 && $currentVal > ($avgUsage * 1.5)) {
            $notable_findings[] = "A significant spike in inventory usage was detected recently, exceeding the average by over 50%.";
        }

        // Recommendations & Depletion Logic
        $recommendations = [];
        $lowStockItems = Inventory::where('stock_level', '<=', DB::raw('min_stock_level'))->limit(3)->get();
        foreach ($lowStockItems as $item) {
            // Simple DCR for this specific item (past 30 days)
            $itemUsage30 = InvoiceItem::where('inventory_id', $item->id)
                ->whereHas('invoice', function($q) { $q->realized(); })
                ->where('created_at', '>=', now()->subDays(30))
                ->sum('qty');
            
            $dcr = $itemUsage30 / 30;
            
            if ($item->stock_level <= 0) {
                $recommendations[] = "OUT OF STOCK: [{$item->item_name}] is depleted. Restock immediately to resume related services.";
            } elseif ($item->stock_level <= $item->min_stock_level) {
                $recommendations[] = "Low stock alert: [{$item->item_name}] is below minimum level. Consider reordering soon.";
            }
        }

        if (empty($recommendations) && $label_mode === 'ai') {
            $recommendations[] = "Stock levels are currently healthy. No immediate reorders required.";
        }

        return response()->json([
            'success' => true,
            'range' => strtolower($monthsToFetch . '_months'),
            'label_mode' => $label_mode,
            'data' => $chartResults,
            'interpretation' => $interpretation,
            'recommendations' => $recommendations,
            'notable_findings' => $label_mode === 'ai' ? $notable_findings : [],
            'data_basis' => $n >= 2 ? "Based on 30-day DCR and linear regression on completed invoices from " . $startMonth->format('M Y') . " to " . $now->format('M Y') . "." : "Monitoring initial consumption rates.",
            'confidence_note' => $confidence_note
        ]);
        
        } catch (\Exception $e) {
            \Log::error('Inventory Consumption Analytics Error: ' . $e->getMessage(), [
                'trace' => $e->getTraceAsString()
            ]);
            
            return response()->json([
                'success' => false,
                'message' => 'An error occurred while generating inventory analytics. Please check parameters or try again later.',
                'label_mode' => 'overview',
                'data' => []
            ], 500);
        }
    }


    /**
     * Get recent notifications.
     */
    public function getNotifications(Request $request)
    {
        $query = \App\Models\Notification::whereNull('read_at')->orderBy('created_at', 'desc');
        
        if ($request->user()) {
            $query->where(function ($q) use ($request) {
                $q->whereNull('user_id')->orWhere('user_id', $request->user()->id);
            });
        }

        $dbNotifications = $query->limit(8)->get();
        $notifications = [];

        foreach ($dbNotifications as $notif) {
            $iconName = 'FiBell';
            $tone = 'info';

            if ($notif->type === 'LowStockAlert' || $notif->type === 'StockAdjustment') {
                $iconName = ($notif->type === 'LowStockAlert') ? 'FiAlertTriangle' : 'FiPackage';
                $tone = 'danger';
                if ($notif->type === 'StockAdjustment') {
                    $tone = (str_contains($notif->message, 'decreased') || str_contains($notif->message, 'deducted')) ? 'danger' : 'success';
                }
            } elseif (str_contains($notif->type, 'Pet') || $notif->type === 'PetAdded') {
                $iconName = 'FiHeart';
                $tone = 'success';
            } elseif (str_contains($notif->type, 'Appointment')) {
                $iconName = 'FiCalendar';
                if ($notif->type === 'AppointmentPending') $tone = 'info';
                if ($notif->type === 'AppointmentApproved') $tone = 'success';
                if ($notif->type === 'AppointmentDeclined') $tone = 'danger';
            } elseif ($notif->type === 'InvoiceFinalized') {
                $iconName = 'FiFileText';
                $tone = 'success';
            } elseif ($notif->type === 'OwnerRegistered' || $notif->type === 'ClientCommunication') {
                $iconName = 'FiUser';
                $tone = 'info';
            }

            $notifications[] = [
                'id' => 'notif-' . $notif->id,
                'db_id' => $notif->id,
                'iconName' => $iconName,
                'tone' => $tone,
                'title' => $notif->title ?? 'Notification',
                'message' => $notif->message ?? '',
                'time' => $notif->created_at ? $notif->created_at->diffForHumans() : 'Just now'
            ];
        }

        return response()->json($notifications);
    }

    public function markNotificationsRead(Request $request)
    {
        $query = \App\Models\Notification::whereNull('read_at');
        
        if ($request->user()) {
            $query->where(function ($q) use ($request) {
                $q->whereNull('user_id')->orWhere('user_id', $request->user()->id);
            });
        }

        $query->update(['read_at' => now()]);

        return response()->json(['status' => 'success']);
    }

    public function dismissNotification(Request $request, $id)
    {
        // Strip 'notif-' prefix if present
        $dbId = str_replace('notif-', '', $id);
        
        $notification = \App\Models\Notification::where('id', $dbId);
        
        if ($request->user()) {
            $notification->where(function ($q) use ($request) {
                $q->whereNull('user_id')->orWhere('user_id', $request->user()->id);
            });
        }

        $notification->update(['read_at' => now()]);

        return response()->json(['status' => 'success']);
    }

    /**
     * Get AI Sales Forecast using Simple Linear Regression and detect anomalies.
     */
    public function getSalesForecast(Request $request)
    {
        $monthsToFetch = $request->query('range', 6) == 'Year' ? 12 : 6;
        $futureMonths = 2;

        $timeline = [];
        $now = Carbon::now()->startOfMonth();
        $startMonth = $now->copy()->subMonths($monthsToFetch - 1);
        
        for ($i = 0; $i < $monthsToFetch; $i++) {
            $timeline[] = ['date' => $startMonth->copy()->addMonths($i), 'is_future' => false];
        }
        for ($i = 1; $i <= $futureMonths; $i++) {
            $timeline[] = ['date' => $now->copy()->addMonths($i), 'is_future' => true];
        }

        $invoices = Invoice::realized()
            ->where('created_at', '>=', $startMonth)
            ->select(
                DB::raw('YEAR(created_at) as year'),
                DB::raw('MONTH(created_at) as month'),
                DB::raw('SUM(total) as total_revenue')
            )
            ->groupBy('year', 'month')
            ->orderBy('year', 'asc')
            ->orderBy('month', 'asc')
            ->get();

        $actualData = [];
        foreach ($invoices as $inv) {
            $key = $inv->year . '-' . str_pad($inv->month, 2, '0', STR_PAD_LEFT);
            $actualData[$key] = (float) $inv->total_revenue;
        }

        $xValues = [];
        $yValues = [];
        foreach ($timeline as $index => $item) {
            if (!$item['is_future']) {
                $key = $item['date']->format('Y-m');
                $val = $actualData[$key] ?? 0;
                $xValues[] = $index;
                $yValues[] = $val;
            }
        }

        // Regression
        $n = count($xValues);
        $m = 0; $b = 0;
        if ($n > 1) {
            $sumX = array_sum($xValues);
            $sumY = array_sum($yValues);
            $sumXY = $sumX2 = 0;
            for ($i = 0; $i < $n; $i++) {
                $sumXY += ($xValues[$i] * $yValues[$i]);
                $sumX2 += ($xValues[$i] * $xValues[$i]);
            }
            $denominator = ($n * $sumX2) - ($sumX * $sumX);
            $m = ($denominator != 0) ? (($n * $sumXY) - ($sumX * $sumY)) / $denominator : 0;
            $b = ($n != 0) ? ($sumY - ($m * $sumX)) / $n : 0;
        } elseif ($n == 1) {
            $b = $yValues[0];
        }

        $chartResults = [];
        foreach ($timeline as $index => $item) {
            $forecastValue = max(0, ($m * $index) + $b);
            $key = $item['date']->format('Y-m');
            $chartResults[] = [
                'month' => $item['date']->format('M'),
                'actual' => $item['is_future'] ? null : ($actualData[$key] ?? 0),
                'forecast' => round($forecastValue, 2)
            ];
        }
        // Interpretation Logic
        $currentMonthKey = $now->format('Y-m');
        $prevMonthKey = $now->copy()->subMonth()->format('Y-m');
        $currentVal = $actualData[$currentMonthKey] ?? 0;
        $prevVal = $actualData[$prevMonthKey] ?? 0;
        $percentChange = null;
        if ($prevVal > 0) {
            $percentChange = (($currentVal - $prevVal) / $prevVal) * 100;
        }

        $label_mode = 'ai';
        $interpretation = "";
        $confidence_note = "";
        $recommendations = [];

        $invoiceCount = Invoice::realized()->where('created_at', '>=', $startMonth)->count();

        if ($n < 2) {
            $label_mode = 'overview';
            $interpretation = "";
            $confidence_note = "Forecast unavailable: insufficient historical data ({$invoiceCount} records). Minimum 2 months required.";
        } else {
            if (is_null($percentChange)) {
                 $interpretation = "No prior period data to establish a valid comparative trend.";
            } else {
                 $interpretation = "Revenue exhibits a " . ($percentChange >= 0 ? "rising" : "declining") . " trend, changing by " . abs(round($percentChange, 1)) . "% this month compared to the previous month.";
            }
            
            if ($invoiceCount > 30) {
                $confidence_note = "Forecast generated from {$invoiceCount} localized records over {$monthsToFetch} months. Reliable trend based on stable dataset.";
            } else {
                $confidence_note = "Forecast generated from {$invoiceCount} records over {$monthsToFetch} months. Limited accuracy due to small dataset.";
            }
        }

        // Anomaly Detection
        $notable_findings = [];
        $avgPast3Months = 0;
        if ($n >= 3) {
            $pastValues = array_slice($yValues, -4, 3);
            if (!empty($pastValues)) {
                $avgPast3Months = array_sum($pastValues) / count($pastValues);
            }
        }

        if ($avgPast3Months > 0) {
            $deviation = (($currentVal - $avgPast3Months) / $avgPast3Months) * 100;
            if (abs($deviation) > 35) {
                $type = $deviation > 0 ? 'spike' : 'drop';
                $notable_findings[] = "A sudden " . abs(round($deviation)) . "% " . $type . " was detected relative to the 3-month rolling average.";
            }
        }

        // Recommendations
        if ($n >= 2) {
            if (!is_null($percentChange) && $percentChange > 15) {
                $recommendations[] = "Revenue density is increasing. Consider auditing service slot availability to maximize throughput.";
            } elseif (!is_null($percentChange) && $percentChange < -15) {
                $recommendations[] = "Transaction volume is pacing slower. Review pending follow-ups for reactivation campaigns.";
            }
        }

        if (!empty($notable_findings) && $label_mode === 'ai') {
            $recommendations[] = "Investigate the root cause of the recent revenue anomaly to proactively manage cashflow.";
        }

        if (empty($recommendations) && $label_mode === 'ai') {
            $recommendations[] = "Revenue patterns appear stable. Continue standard retention operations.";
        }

        return response()->json([
            'success' => true,
            'label_mode' => $label_mode,
            'data' => $chartResults,
            'interpretation' => $interpretation,
            'recommendations' => $recommendations,
            'notable_findings' => $label_mode === 'ai' ? $notable_findings : [],
            'data_basis' => $n >= 2 ? "Linear trend projection based on realized revenue from " . $startMonth->format('M Y') . " to " . $now->format('M Y') . "." : "Monitoring finalized transactions.",
            'confidence_note' => $confidence_note
        ]);
    }
}
