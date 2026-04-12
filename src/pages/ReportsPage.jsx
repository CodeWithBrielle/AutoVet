import * as FiIcons from "react-icons/fi";
import clsx from "clsx";
import React, { useState, useEffect, useMemo } from "react";
import { useAuth } from "../context/AuthContext";
import MetricCard from "../components/dashboard/MetricCard";
import { formatCurrency, formatCurrencyShort } from "../utils/formatters";
import api from "../utils/api";

/**
 * Simple SVG-based Line Chart component.
 * Prevents NaN points and division by zero.
 */
/**
 * Enhanced SVG-based Line Chart component.
 * Includes grid lines, axis labels, and improved aesthetics.
 */
function SimpleLineChart({ data, width = 600, height = 240, color = "#10b981", dataKey = "total", prefix = "" }) {
  if (!data || !Array.isArray(data) || data.length === 0) {
    return <div className="h-[240px] flex items-center justify-center text-slate-400 font-medium bg-slate-50 dark:bg-zinc-900/50 rounded-xl">No historical data available</div>;
  }

  const paddingX = 50;
  const paddingY = 40;
  const values = data.map(d => Number(d[dataKey] || 0));
  const max = Math.max(...values, 10);
  const min = 0; // Standardize to 0 for better trend visibility
  const range = max || 1;

  const points = data.map((d, i) => {
    const x = paddingX + (i * (width - 2 * paddingX) / (data.length > 1 ? data.length - 1 : 1));
    const y = height - paddingY - (values[i] / range * (height - 2 * paddingY));
    return `${x},${y}`;
  }).join(" ");

  // Grid lines
  const gridLines = [0, 0.25, 0.5, 0.75, 1].map(p => {
    const val = p * max;
    return {
      y: height - paddingY - p * (height - 2 * paddingY),
      label: prefix === "₱" ? formatCurrencyShort(val) : val.toLocaleString()
    };
  });

  return (
    <div className="w-full overflow-hidden">
      <svg width="100%" height={height} viewBox={`0 0 ${width} ${height}`} className="overflow-visible">
        {/* Grid Lines & Y Labels */}
        {gridLines.map((line, i) => (
          <g key={i}>
            <line x1={paddingX} y1={line.y} x2={width - paddingX} y2={line.y} stroke="currentColor" className="text-slate-200 dark:text-zinc-800" strokeDasharray="4 4" />
            <text x={paddingX - 10} y={line.y + 4} textAnchor="end" fontSize="10" className="fill-slate-400 dark:fill-zinc-500 font-bold">{line.label}</text>
          </g>
        ))}

        {/* The Line */}
        <polyline
          points={points}
          fill="none"
          stroke={color}
          strokeWidth="4"
          strokeLinecap="round"
          strokeLinejoin="round"
          className="drop-shadow-sm"
        />

        {/* Data Points */}
        {data.map((d, i) => {
          const x = paddingX + (i * (width - 2 * paddingX) / (data.length > 1 ? data.length - 1 : 1));
          const y = height - paddingY - (values[i] / range * (height - 2 * paddingY));
          return (
            <g key={i} className="group">
              <circle cx={x} cy={y} r="5" fill={color} className="transition-transform group-hover:scale-150" />
              <text x={x} y={y - 12} textAnchor="middle" fontSize="9" className="fill-slate-800 dark:fill-zinc-200 font-bold opacity-0 group-hover:opacity-100 transition-opacity">
                {prefix === "₱" ? formatCurrency(values[i]) : values[i].toLocaleString()}
              </text>
            </g>
          );
        })}

        {/* Simplified X Labels (Show first, mid, last) */}
        {[0, Math.floor(data.length / 2), data.length - 1].map((index, i) => {
           if (index < 0 || index >= data.length) return null;
           const d = data[index];
           const x = paddingX + (index * (width - 2 * paddingX) / (data.length > 1 ? data.length - 1 : 1));
           return (
             <text key={`${index}-${i}`} x={x} y={height - 10} textAnchor="middle" fontSize="10" className="fill-slate-500 dark:fill-zinc-400 font-bold">
               {d.date || d.label || d.name || ""}
             </text>
           );
        })}
      </svg>
    </div>
  );
}

/**
 * Enhanced SVG-based Bar Chart component.
 * Optimized for readability with clear labels and spacing.
 */
function SimpleBarChart({ data, width = 600, height = 300, color = "#6366f1", prefix = "" }) {
  if (!data || !Array.isArray(data) || data.length === 0) {
    return <div className="h-[300px] flex items-center justify-center text-slate-400 font-medium bg-slate-50 dark:bg-zinc-900/50 rounded-xl">No distribution data found</div>;
  }

  const paddingX = 60;
  const paddingY = 60;
  const dataValues = data.map(d => Number(d.total_revenue || d.value || d.count || d.total || 0));
  const maxValue = Math.max(...dataValues, 1);
  const barGap = 15;
  const barWidth = Math.max((width - 2 * paddingX) / data.length - barGap, 10);

  return (
    <div className="w-full overflow-hidden">
      <svg width="100%" height={height} viewBox={`0 0 ${width} ${height}`} className="overflow-visible">
        {/* Simple Horizontal Grid */}
        {[0, 0.5, 1].map(p => {
          const y = height - paddingY - p * (height - 2 * paddingY);
          return (
            <line key={p} x1={paddingX} y1={y} x2={width - paddingX} y2={y} stroke="currentColor" className="text-slate-100 dark:text-zinc-800" />
          );
        })}

        {data.map((d, i) => {
          const val = Number(d.total_revenue || d.value || d.count || d.total || 0);
          const barHeight = (val / maxValue) * (height - 2 * paddingY);
          const x = paddingX + i * (barWidth + barGap);
          const y = height - paddingY - barHeight;
          const label = String(d.item_name || d.name || d.label || "");

          return (
            <g key={i} className="group">
              <rect
                x={x}
                y={y}
                width={barWidth}
                height={barHeight}
                fill={color}
                rx="6"
                className="transition-opacity hover:opacity-80"
              />
              {/* Value label on top of bar */}
              <text x={x + barWidth / 2} y={y - 10} textAnchor="middle" fontSize="10" className="fill-slate-900 dark:fill-zinc-200 font-black">
                {prefix === "₱" ? formatCurrencyShort(val) : val.toLocaleString()}
              </text>
              {/* Vertical label for better fit */}
              <text
                x={x + barWidth / 2}
                y={height - 45}
                textAnchor="end"
                fontSize="10"
                transform={`rotate(-45, ${x + barWidth / 2}, ${height - 45})`}
                className="fill-slate-500 dark:fill-zinc-400 font-semibold"
              >
                {label.length > 15 ? label.substring(0, 12) + "..." : label}
              </text>
            </g>
          );
        })}
      </svg>
    </div>
  );
}

function ReportsPage() {
  const [activeTab, setActiveTab] = useState("Sales");
  const [salesData, setSalesData] = useState({ revenue: [], topServices: [], volume: [] });
  const [patientData, setPatientData] = useState({ species: [], trends: [], demographics: {} });
  const [inventoryData, setInventoryData] = useState({ summary: null, topMoving: [], movements: [], expiringSoon: [], forecast: null });
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const { user } = useAuth();

  useEffect(() => {
    if (!user?.token) return;
    let isMounted = true;
    setIsLoading(true);
    setError(null);

    const fetchData = async () => {
      try {
        if (activeTab === "Sales") {
          const [revenueRes, topServicesRes, volumeRes] = await Promise.all([
            api.get("/api/reports/sales/revenue-summary"),
            api.get("/api/reports/sales/top-services"),
            api.get("/api/reports/sales/transaction-volume")
          ]);
          if (isMounted) setSalesData({ 
            revenue: revenueRes.data, 
            topServices: topServicesRes.data, 
            volume: volumeRes.data 
          });
        } else if (activeTab === "Patients") {
          const [speciesRes, trendsRes, demographicsRes] = await Promise.all([
            api.get("/api/reports/patients/species-distribution"),
            api.get("/api/reports/patients/registration-trends"),
            api.get("/api/reports/patients/demographics")
          ]);
          if (isMounted) setPatientData({ 
            species: speciesRes.data, 
            trends: trendsRes.data, 
            demographics: demographicsRes.data 
          });
        } else if (activeTab === "Inventory") {
          const [summaryRes, topMovingRes, movementsRes, expiringSoonRes, forecastRes] = await Promise.all([
            api.get("/api/reports/inventory/summary"),
            api.get("/api/reports/inventory/top-moving"),
            api.get("/api/reports/inventory/recent-movements"),
            api.get("/api/reports/inventory/expiring-soon"),
            api.get("/api/dashboard/inventory-forecast")
          ]);
          if (isMounted) setInventoryData({ 
            summary: summaryRes.data, 
            topMoving: topMovingRes.data, 
            movements: movementsRes.data, 
            expiringSoon: expiringSoonRes.data, 
            forecast: forecastRes.data 
          });
        }
      } catch (err) {
        console.error("Reports data fetch failed:", err);
        if (isMounted) setError("Failed to load report data. Please check your connection and try again.");
      } finally {
        if (isMounted) setIsLoading(false);
      }
    };

    fetchData();

    return () => { isMounted = false; };
  }, [activeTab, user?.token]);

  // Defensive Metrics Normalization
  const salesMetrics = useMemo(() => {
    const revenue = Array.isArray(salesData.revenue) 
      ? salesData.revenue.reduce((acc, curr) => acc + Number(curr.total || 0), 0)
      : (typeof salesData.revenue === 'number' ? salesData.revenue : 0);
    
    const volume = Array.isArray(salesData.volume)
      ? salesData.volume.reduce((acc, curr) => acc + Number(curr.count || 0), 0)
      : (typeof salesData.volume === 'number' ? salesData.volume : 0);
      
    const avgTicket = volume > 0 ? revenue / volume : 0;
    
    return { totalRevenue: revenue, totalVolume: volume, avgTicket };
  }, [salesData]);

  const patientMetrics = useMemo(() => {
    const totalPatients = Array.isArray(patientData.trends)
      ? patientData.trends.reduce((acc, curr) => acc + Number(curr.total || 0), 0)
      : 0;
    return { totalPatients };
  }, [patientData]);

  const tabs = [
    { name: "Sales", icon: FiIcons.FiTrendingUp },
    { name: "Patients", icon: FiIcons.FiPieChart },
    { name: "Inventory", icon: FiIcons.FiClipboard },
  ];

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="text-3xl font-bold tracking-tight text-slate-900 dark:text-zinc-50">Advanced Reports</h2>
          <p className="mt-1 text-slate-500 dark:text-zinc-400">Analyze clinic data, revenue, and patient demographics.</p>
        </div>
        <button className="inline-flex items-center gap-2 rounded-xl bg-emerald-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-emerald-700 transition-colors">
          <FiIcons.FiDownload className="w-4 h-4" />
          Export All Data
        </button>
      </div>

      <div className="flex border-b border-slate-200 dark:border-zinc-800">
        {tabs.map((tab) => (
          <button
            key={tab.name}
            onClick={() => setActiveTab(tab.name)}
            className={clsx(
              "flex items-center gap-2 px-6 py-3 text-sm font-semibold transition-all border-b-2 hover:bg-slate-50 dark:hover:bg-zinc-900",
              activeTab === tab.name
                ? "border-emerald-500 text-emerald-600 dark:text-emerald-400"
                : "border-transparent text-slate-500 dark:text-zinc-500"
            )}
          >
            <tab.icon className="w-4 h-4" />
            {tab.name}
          </button>
        ))}
      </div>

      {isLoading ? (
        <div className="h-64 flex items-center justify-center text-slate-500">
          <div className="flex flex-col items-center gap-3">
            <div className="h-8 w-8 animate-spin rounded-full border-4 border-emerald-500 border-t-transparent"></div>
            <span>Loading Report Data...</span>
          </div>
        </div>
      ) : error ? (
        <div className="h-64 flex flex-col items-center justify-center text-center space-y-4 rounded-3xl border-2 border-dashed border-rose-100 bg-rose-50/50 p-12 dark:border-rose-900/20 dark:bg-rose-900/10">
          <FiIcons.FiAlertCircle className="w-12 h-12 text-rose-500" />
          <h3 className="text-xl font-black text-slate-900 dark:text-zinc-50 uppercase tracking-widest">Report Error</h3>
          <p className="max-w-xs text-sm text-slate-500 font-medium">{error}</p>
          <button 
            onClick={() => window.location.reload()}
            className="mt-4 px-6 py-2.5 rounded-xl bg-slate-900 text-white font-bold text-sm hover:scale-105 transition-transform dark:bg-zinc-100 dark:text-zinc-950"
          >
            Retry Fetch
          </button>
        </div>
      ) : (
        <div className="w-full">
          {activeTab === "Sales" && (
            <section className="animate-in fade-in slide-in-from-bottom-4 duration-500 w-full">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8 w-full">
            <MetricCard card={{
              title: "Revenue (Last 30 Days)",
              value: formatCurrency(salesMetrics.totalRevenue),
              icon: FiIcons.FiDollarSign,
              iconBg: "bg-emerald-50 dark:bg-emerald-900/20",
              iconColor: "text-emerald-600 dark:text-emerald-400",
              detail: "Current 30-day realized income"
            }} />
            <MetricCard card={{
              title: "Avg Ticket Value",
              value: formatCurrency(salesMetrics.avgTicket),
              icon: FiIcons.FiShoppingCart,
              iconBg: "bg-indigo-50 dark:bg-indigo-900/20",
              iconColor: "text-indigo-600 dark:text-indigo-400",
              detail: "Revenue per transaction"
            }} />
            <MetricCard card={{
              title: "Tx Volume",
              value: salesMetrics.totalVolume.toLocaleString(),
              icon: FiIcons.FiActivity,
              iconBg: "bg-amber-50 dark:bg-amber-900/20",
              iconColor: "text-amber-600 dark:text-amber-400",
              detail: "Finalized invoice events"
            }} />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-8 w-full">
            <div className="card-shell p-8">
              <div className="flex items-center justify-between mb-8">
                <div>
                  <h3 className="text-xl font-black text-slate-800 dark:text-zinc-50 tracking-tight">Revenue Stream</h3>
                  <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mt-1">Realized Cashflow • Last 30 Days</p>
                </div>
                <div className="rounded-full bg-emerald-100 p-2 dark:bg-emerald-900/30">
                  <FiIcons.FiTrendingUp className="text-emerald-600 h-5 w-5" />
                </div>
              </div>
              <SimpleLineChart data={salesData.revenue} color="#10b981" prefix="₱" />
            </div>

            <div className="card-shell p-8">
              <div className="flex items-center justify-between mb-8">
                <div>
                  <h3 className="text-xl font-black text-slate-800 dark:text-zinc-50 tracking-tight">Top Performance</h3>
                  <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mt-1">Services by Revenue Weight</p>
                </div>
                <div className="rounded-full bg-indigo-100 p-2 dark:bg-indigo-900/30">
                  <FiIcons.FiBarChart2 className="text-indigo-600 h-5 w-5" />
                </div>
              </div>
              <SimpleBarChart data={salesData.topServices} color="#6366f1" prefix="₱" />
            </div>

            <div className="card-shell p-8 col-span-full">
              <div className="flex items-center justify-between mb-8">
                <div>
                  <h3 className="text-xl font-black text-slate-800 dark:text-zinc-50 tracking-tight">Activity Density</h3>
                  <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mt-1">Finalized Transaction Volume Forecast</p>
                </div>
                <div className="rounded-full bg-amber-100 p-2 dark:bg-amber-900/30">
                  <FiIcons.FiActivity className="text-amber-600 h-5 w-5" />
                </div>
              </div>
              <SimpleLineChart data={salesData.volume} dataKey="count" color="#f59e0b" />
            </div>
          </div>
        </section>
      )}

      {activeTab === "Patients" && (
        <section className="animate-in fade-in slide-in-from-bottom-4 duration-500 w-full">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8 w-full">
             <MetricCard card={{
                title: "Active Database",
                value: patientMetrics.totalPatients.toLocaleString(),
                icon: FiIcons.FiUsers,
                iconBg: "bg-blue-50 dark:bg-blue-900/20",
                iconColor: "text-blue-600 dark:text-blue-400",
                detail: "Total patients registered"
             }} />
             <MetricCard card={{
                title: "Species Diversity",
                value: patientData.species.length.toString(),
                icon: FiIcons.FiTarget,
                iconBg: "bg-rose-50 dark:bg-rose-900/20",
                iconColor: "text-rose-600 dark:text-rose-400",
                detail: "Unique pet species categorized"
             }} />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-8 w-full">
            <div className="card-shell p-8">
              <div className="flex items-center justify-between mb-8">
                <div>
                  <h3 className="text-xl font-black text-slate-800 dark:text-zinc-50 tracking-tight">Biological Spread</h3>
                  <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mt-1">Patient Population by Species</p>
                </div>
              </div>
              <SimpleBarChart data={patientData.species} color="#3b82f6" />
            </div>
            <div className="card-shell p-8">
               <div className="flex items-center justify-between mb-8">
                <div>
                  <h3 className="text-xl font-black text-slate-800 dark:text-zinc-50 tracking-tight">Growth Velocity</h3>
                  <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mt-1">New Registrations Gradient</p>
                </div>
              </div>
              <SimpleLineChart data={patientData.trends} dataKey="total" color="#10b981" />
            </div>
          </div>
        </section>
      )}

      {activeTab === "Inventory" && (
        <section className="animate-in fade-in slide-in-from-bottom-4 duration-500 w-full space-y-8">
          {inventoryData.summary ? (
            <>
              {/* Summary Metrics */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 xl:grid-cols-5 gap-6 w-full">
                <MetricCard card={{
                  title: "Total SKUs",
                  value: inventoryData.summary.total_items.toString(),
                  icon: FiIcons.FiBox,
                  iconBg: "bg-blue-50 dark:bg-blue-900/20",
                  iconColor: "text-blue-600 dark:text-blue-400",
                  detail: "Unique items tracked"
                }} />
                 <MetricCard card={{
                  title: "Low Stock",
                  value: inventoryData.summary.low_stock.toString(),
                  icon: FiIcons.FiAlertCircle,
                  iconBg: "bg-amber-50 dark:bg-amber-900/20",
                  iconColor: "text-amber-600 dark:text-amber-400",
                  detail: "Items near threshold"
                }} />
                <MetricCard card={{
                  title: "Out of Stock",
                  value: inventoryData.summary.out_of_stock.toString(),
                  icon: FiIcons.FiSlash,
                  iconBg: "bg-rose-50 dark:bg-rose-900/20",
                  iconColor: "text-rose-600 dark:text-rose-400",
                  detail: "Critical depletion"
                }} />
                <MetricCard card={{
                  title: "Expiring Soon",
                  value: inventoryData.summary.expiring_soon.toString(),
                  icon: FiIcons.FiClock,
                  iconBg: "bg-orange-50 dark:bg-orange-900/20",
                  iconColor: "text-orange-600 dark:text-orange-400",
                  detail: "Next 30 days"
                }} />
                <MetricCard card={{
                  title: "Inventory Value",
                  value: formatCurrency(inventoryData.summary.total_value),
                  icon: FiIcons.FiDollarSign,
                  iconBg: "bg-emerald-50 dark:bg-emerald-900/20",
                  iconColor: "text-emerald-600 dark:text-emerald-400",
                  detail: "Total cost basis"
                }} />
              </div>

              {/* Main Insights Grid */}
              <div className="grid grid-cols-1 xl:grid-cols-3 gap-8 w-full">
                
                {/* Left Column: Alerts & Consumption */}
                <div className="xl:col-span-2 space-y-8">
                  
                  {/* Consumption Chart Component replacement (Simple Bar) */}
                  <div className="card-shell p-8">
                    <div className="flex items-center justify-between mb-8">
                      <div>
                        <h3 className="text-xl font-black text-slate-800 dark:text-zinc-50 tracking-tight">Most Consumed Items</h3>
                        <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mt-1">Highest clinical usage volume</p>
                      </div>
                      <div className="rounded-full bg-blue-100 p-2 dark:bg-blue-900/30">
                        <FiIcons.FiActivity className="text-blue-600 h-5 w-5" />
                      </div>
                    </div>
                    {inventoryData.topMoving.length > 0 ? (
                       <SimpleBarChart 
                        data={inventoryData.topMoving.map(item => ({
                          label: item.inventory?.item_name || 'Unknown',
                          total: parseFloat(item.total_quantity)
                        }))} 
                        color="#3b82f6" 
                      />
                    ) : (
                      <div className="h-[200px] flex items-center justify-center text-slate-400 font-medium">No consumption data available</div>
                    )}
                  </div>

                  {/* Stock Movements List */}
                  <div className="card-shell overflow-hidden">
                    <div className="p-8 border-b border-slate-100 dark:border-zinc-800 flex items-center justify-between bg-slate-50/50 dark:bg-zinc-900/30">
                       <h3 className="text-xl font-black text-slate-800 dark:text-zinc-50 tracking-tight">Recent Stock Dynamics</h3>
                       <button 
                        onClick={() => window.location.href = '/inventory'}
                        className="text-xs font-black text-blue-600 dark:text-blue-400 uppercase tracking-widest hover:underline"
                       >
                         Full Audit Log
                       </button>
                    </div>
                    <div className="overflow-x-auto">
                      <table className="w-full text-left">
                        <thead>
                          <tr className="border-b border-slate-100 dark:border-zinc-800 text-[10px] font-black uppercase tracking-widest text-slate-400">
                            <th className="px-8 py-4">Item</th>
                            <th className="px-8 py-4">Status</th>
                            <th className="px-8 py-4">Type</th>
                            <th className="px-8 py-4 text-right">Adjustment</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-50 dark:divide-zinc-800/50">
                          {inventoryData.movements.map((move, i) => (
                            <tr key={i} className="hover:bg-slate-50/50 dark:hover:bg-zinc-800/30 transition-colors">
                              <td className="px-8 py-4">
                                <p className="text-sm font-bold text-slate-800 dark:text-zinc-100">{move.inventory?.item_name || 'Deleted Item'}</p>
                                <p className="text-[10px] text-slate-400 font-medium tracking-tight">SKU: {move.inventory?.sku || 'N/A'}</p>
                              </td>
                              <td className="px-8 py-4">
                                <span className={clsx(
                                  "inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-black uppercase tracking-wider",
                                  move.new_stock > move.previous_stock ? "bg-emerald-50 text-emerald-600 dark:bg-emerald-900/20" : "bg-rose-50 text-rose-600 dark:bg-rose-900/20"
                                )}>
                                  {move.new_stock} In Stock
                                </span>
                              </td>
                              <td className="px-8 py-4">
                                <span className="text-[11px] font-bold text-slate-500 dark:text-zinc-400">{move.transaction_type}</span>
                              </td>
                              <td className="px-8 py-4 text-right font-black text-sm text-slate-700 dark:text-zinc-200">
                                {move.quantity > 0 ? "+" : ""}{move.quantity}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>

                {/* Right Column: AI Snippet & Quick Lists */}
                <div className="space-y-8">
                  
                  {/* AI Snippet Card */}
                  {inventoryData.forecast && (
                    <div className="card-shell p-8 bg-slate-900 dark:bg-zinc-900 border-none shadow-2xl relative overflow-hidden group">
                      <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:scale-110 transition-transform">
                        <FiIcons.FiZap className="w-16 h-16 text-blue-400" />
                      </div>
                      <div className="relative z-10">
                        <div className="flex items-center gap-2 mb-4">
                          <div className="rounded-full bg-blue-500/20 p-1.5 ring-1 ring-blue-500/30">
                            <FiIcons.FiCpu className="text-blue-400 h-4 w-4" />
                          </div>
                          <span className="text-[10px] font-black text-blue-400 uppercase tracking-[0.2em]">Forecasting Insight</span>
                        </div>
                        <h4 className="text-lg font-black text-white leading-tight mb-2">{inventoryData.forecast.item_name}</h4>
                        <p className="text-sm text-slate-300 font-medium leading-relaxed mb-6">{inventoryData.forecast.analysis}</p>
                        <div className="bg-white/5 rounded-2xl p-4 border border-white/10">
                           <div className="flex justify-between items-end">
                              <div>
                                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Stockout Velocity</p>
                                <p className="text-xl font-black text-white">{inventoryData.forecast.growth_label}</p>
                              </div>
                              <button 
                                onClick={() => window.location.href = '/inventory'}
                                className="h-10 w-10 flex items-center justify-center rounded-xl bg-blue-500 text-white shadow-lg shadow-blue-500/30 hover:bg-blue-400 transition-colors"
                              >
                                <FiIcons.FiArrowRight />
                              </button>
                           </div>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Expiration Watchlist */}
                  <div className="card-shell">
                    <div className="p-6 border-b border-slate-100 dark:border-zinc-800">
                      <h4 className="text-sm font-black text-slate-800 dark:text-zinc-50 uppercase tracking-[0.2em]">Expiration Watchlist</h4>
                    </div>
                    <div className="p-2">
                       {inventoryData.expiringSoon.length > 0 ? (
                         inventoryData.expiringSoon.map((item, i) => (
                           <div key={i} className="flex items-center gap-4 p-4 rounded-xl hover:bg-slate-50 dark:hover:bg-zinc-800/50 transition-colors">
                              <div className="h-10 w-10 shrink-0 rounded-xl bg-orange-50 dark:bg-orange-900/20 flex items-center justify-center">
                                 <FiIcons.FiBox className="text-orange-500 h-5 w-5" />
                              </div>
                              <div className="min-w-0 flex-1">
                                <p className="text-sm font-bold text-slate-800 dark:text-zinc-100 truncate">{item.item_name}</p>
                                <p className="text-[10px] font-black text-orange-600 dark:text-orange-400 uppercase tracking-widest mt-0.5">Expires {new Date(item.expiration_date).toLocaleDateString()}</p>
                              </div>
                              <div className="text-right">
                                <p className="text-sm font-black text-slate-900 dark:text-zinc-50">{item.stock_level}</p>
                                <p className="text-[9px] font-bold text-slate-400 uppercase">Left</p>
                              </div>
                           </div>
                         ))
                       ) : (
                         <div className="p-6 text-center text-xs font-bold text-slate-400 uppercase tracking-widest">No immediate expirations</div>
                       )}
                    </div>
                    <div className="p-4 bg-slate-50/50 dark:bg-zinc-900/30 mt-2">
                       <button 
                        onClick={() => window.location.href = '/inventory'}
                        className="w-full flex items-center justify-center gap-2 py-3 rounded-xl border border-slate-200 dark:border-dark-border text-[11px] font-black text-slate-600 dark:text-zinc-400 uppercase tracking-[0.2em] hover:bg-white dark:hover:bg-zinc-800 transition-all"
                       >
                         Manage Full Catalog <FiIcons.FiExternalLink />
                       </button>
                    </div>
                  </div>

                </div>
              </div>
            </>
          ) : (
            <div className="h-96 flex flex-col items-center justify-center text-center space-y-4">
               <FiIcons.FiInfo className="w-12 h-12 text-slate-300" />
               <p className="text-xl font-black text-slate-400 uppercase tracking-widest">No Inventory Insights Available Yet</p>
               <p className="max-w-xs text-sm text-slate-400 font-medium">Add stock to the clinical database to unlock deep inventory reports.</p>
               <button onClick={() => window.location.href = '/inventory'} className="mt-4 text-blue-600 font-black uppercase tracking-widest text-xs hover:underline">Go to Inventory Module</button>
            </div>
          )}
        </section>
      )}
        </div>
      )}
    </div>
  );
}

export default ReportsPage;
