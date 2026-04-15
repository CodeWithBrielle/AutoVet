<?php

namespace App\Http\Controllers;

use App\Models\Pet;
use App\Models\Owner;
use App\Models\Species;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Carbon\Carbon;

class PetReportController extends Controller
{
    /**
     * Get species distribution.
     */
    public function getSpeciesDistribution()
    {
        $distribution = Pet::select('species_id', DB::raw('count(*) as total'))
            ->with('species:id,name')
            ->groupBy('species_id')
            ->get()
            ->map(function ($item) {
                return [
                    'name' => $item->species->name ?? 'Unknown',
                    'value' => $item->total
                ];
            });

        return response()->json([
            'success' => true,
            'label_mode' => 'overview',
            'data' => $distribution,
            'interpretation' => "",
            'recommendations' => [],
            'notable_findings' => [],
            'data_basis' => "Total active pets grouped by species.",
            'confidence_note' => ""
        ]);
    }

    /**
     * Get owner registration trends.
     */
    public function getRegistrationTrends(Request $request)
    {
        $months = $request->query('months', 6);
        $startDate = Carbon::now()->subMonths($months);

        $trends = Owner::where('created_at', '>=', $startDate)
            ->select(
                DB::raw("DATE_FORMAT(created_at, '%Y-%m') as month"),
                DB::raw('COUNT(*) as total')
            )
            ->groupBy('month')
            ->orderBy('month')
            ->get();

        $label_mode = 'overview';
        $interpretation = "";
        $recommendations = [];
        $confidence_note = "";
        
        $count = $trends->count();
        if ($count >= 2) {
            $currentMonth = $trends[$count - 1]->total;
            $prevMonth = $trends[$count - 2]->total;
            
            $percentChange = $prevMonth > 0 ? (($currentMonth - $prevMonth) / $prevMonth) * 100 : 100;
            $trendPattern = $percentChange >= 0 ? "an upward pattern" : "a downward pattern";
            
            $interpretation = "New client registrations exhibit {$trendPattern}, changing by " . abs(round($percentChange, 1)) . "% this month compared to last month.";
            
            if ($percentChange > 20) {
                $recommendations[] = "Client base is expanding rapidly. Ensure enough front desk staff handles new registrations.";
            } elseif ($percentChange < -20) {
                $recommendations[] = "New client acquisitions have slowed. Consider a referral marketing campaign.";
            }
        } else {
            $interpretation = "";
            $confidence_note = "Insufficient historical data for forecasting.";
        }

        return response()->json([
            'success' => true,
            'label_mode' => $label_mode,
            'data' => $trends,
            'interpretation' => $interpretation,
            'recommendations' => $recommendations,
            'notable_findings' => [],
            'data_basis' => "Monthly new owner registrations over the past {$months} months.",
            'confidence_note' => $confidence_note
        ]);
    }

    /**
     * Get pet demographics (Sex, Size).
     */
    public function getDemographics()
    {
        $sexDistribution = Pet::select('sex', DB::raw('count(*) as total'))
            ->groupBy('sex')
            ->get();

        return response()->json([
            'success' => true,
            'label_mode' => 'overview',
            'data' => [
                'sex' => $sexDistribution
            ],
            'interpretation' => "",
            'recommendations' => [],
            'notable_findings' => [],
            'data_basis' => "Demographics across all active registered pets.",
            'confidence_note' => ""
        ]);
    }
}
