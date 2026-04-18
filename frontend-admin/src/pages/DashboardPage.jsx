import { useState, useEffect, useMemo } from "react";
import InventoryForecastInsights from "../components/dashboard/InventoryForecastInsights";
import MetricCard from "../components/dashboard/MetricCard";
import RecentNotificationsCard from "../components/dashboard/RecentNotificationsCard";
import AiSalesForecastCard from "../components/dashboard/AiSalesForecastCard";
import InventoryChartCard from "../components/dashboard/InventoryChartCard";
import ErrorBoundary from "../components/ErrorBoundary";
import * as Icons from "react-icons/fi";
import * as LuIcons from "react-icons/lu";
import { FiTrendingUp, FiArrowUpRight, FiActivity, FiClock, FiUsers, FiCalendar, FiCheckCircle, FiXCircle } from "react-icons/fi";
import { LuSparkles } from "react-icons/lu";
import { useAuth } from "../context/AuthContext";
import { ROLES } from "../constants/roles";
import { useApi } from "../hooks/useApi";
import clsx from "clsx";

const COLORS = {
  Consultation: "#3b82f6",
  Grooming: "#a855f7",
  Vaccination: "#10b981",
  Laboratory: "#f59e0b",
};

const SERVICE_LIST = ["Consultation", "Grooming", "Vaccination", "Laboratory"];

const ServiceTab = ({ name, active, onClick, color }) => (
  <button
    onClick={() => onClick(name)}
    className={clsx(
      "relative px-6 py-3 text-sm font-black transition-all duration-300 rounded-xl overflow-hidden group",
      active 
        ? "text-white shadow-lg" 
        : "text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300"
    )}
  >
    {active && (
      <div 
        className="absolute inset-0 z-0 animate-in fade-in zoom-in duration-300"
        style={{ backgroundColor: color }}
      />
    )}
    <span className="relative z-10 uppercase tracking-widest">{name}</span>
  </button>
);

function ColumnChart({ data, service, color }) {
  const WIDTH = 800;
  const HEIGHT = 400;
  const PADDING_BOTTOM = 40;
  const PADDING_LEFT = 60;
  const PADDING_TOP = 20;
  const PADDING_RIGHT = 20;

  const [hoveredIndex, setHoveredIndex] = useState(null);

  const points = useMemo(() => {
    if (!data || !data.length) return [];
    
    let max = 1;
    data.forEach(p => {
        const sData = p[service] || { actual: 0, forecast: 0 };
        const val = Math.max(sData.actual || 0, sData.forecast || 0);
        if (val > max) max = val;
    });
    max = max * 1.2;

    const xStep = (WIDTH - PADDING_LEFT - PADDING_RIGHT) / (data.length);
    const yFactor = (HEIGHT - PADDING_BOTTOM - PADDING_TOP) / max;

    return data.map((p, i) => {
        const sData = p[service] || { actual: 0, forecast: 0 };
        const isForecast = sData.actual === null;
        const val = isForecast ? sData.forecast : sData.actual;
        const x = PADDING_LEFT + i * xStep + xStep / 2;
        const y = HEIGHT - PADDING_BOTTOM - (val * yFactor);
        const h = val * yFactor;

        return {
            x, y, h, 
            val: val.toFixed(1),
            label: p.month,
            isForecast,
            width: xStep * 0.7
        };
    });
  }, [data, service]);

  const trendLinePath = useMemo(() => {
    if (points.length < 2) return "";
    return points.map((p, i) => `${i === 0 ? 'M' : 'L'}${p.x},${p.y}`).join(" ");
  }, [points]);

  return (
    <div className="relative w-full">
      <svg viewBox={`0 0 ${WIDTH} ${HEIGHT}`} className="w-full h-auto overflow-visible select-none">
        {[0, 0.25, 0.5, 0.75, 1].map((r, i) => {
            const h = HEIGHT - PADDING_BOTTOM - (HEIGHT - PADDING_BOTTOM - PADDING_TOP) * r;
            return (
                <g key={i}>
                    <line x1={PADDING_LEFT} y1={h} x2={WIDTH - PADDING_RIGHT} y2={h} className="stroke-zinc-100 dark:stroke-zinc-800" strokeWidth="1" strokeDasharray="4 4" />
                </g>
            );
        })}
        {points.map((p, i) => (
            <text key={i} x={p.x} y={HEIGHT - 10} className={clsx("text-[10px] font-black uppercase tracking-tighter text-center fill-zinc-400", p.isForecast && "fill-purple-500")} textAnchor="middle">
                {p.label}
            </text>
        ))}
        {points.map((p, i) => (
            <g key={i} onMouseEnter={() => setHoveredIndex(i)} onMouseLeave={() => setHoveredIndex(null)} className="cursor-pointer">
                {p.isForecast && <rect x={p.x - p.width / 2} y={p.y} width={p.width} height={p.h} rx="8" className="fill-purple-500/20 animate-pulse" />}
                <rect x={p.x - p.width / 2} y={p.y} width={p.width} height={p.h} rx="8" className={clsx("transition-all duration-500", p.isForecast ? "fill-purple-500 shadow-xl shadow-purple-500/20" : "fill-zinc-200 dark:fill-zinc-800 hover:fill-zinc-300 dark:hover:fill-zinc-700")} />
            </g>
        ))}
        <path d={trendLinePath} fill="none" stroke={color} strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" className="opacity-40 pointer-events-none" />
        {points.map((p, i) => (
            <circle key={i} cx={p.x} cy={p.y} r="4" fill={p.isForecast ? "#a855f7" : color} className="opacity-60" />
        ))}
        {hoveredIndex !== null && (
            <g className="pointer-events-none transition-all duration-300">
                <rect x={points[hoveredIndex].x - 40} y={points[hoveredIndex].y - 50} width="80" height="40" rx="8" className="fill-zinc-900 shadow-2xl" />
                <text x={points[hoveredIndex].x} y={points[hoveredIndex].y - 35} className="fill-white text-[10px] font-black uppercase tracking-widest" textAnchor="middle">
                    {points[hoveredIndex].isForecast ? "Forecast" : "Actual"}
                </text>
                <text x={points[hoveredIndex].x} y={points[hoveredIndex].y - 20} className="fill-white text-sm font-black" textAnchor="middle">
                    {points[hoveredIndex].val}
                </text>
            </g>
        )}
      </svg>
    </div>
  );
}

function DashboardPage() {
  const { user } = useAuth();
  const isStaff = user?.role === ROLES.STAFF;
  const enabled = !!user?.token;

  // AI Forecast State
  const [activeTab, setActiveTab] = useState("Consultation");
  const [aiData, setAiData] = useState(null);
  const [isAiLoading, setIsAiLoading] = useState(true);

  // New Dashboard Hooks
  const { data: stats } = useApi(['dashboard-stats'], '/api/dashboard/stats', { enabled, cacheKey: 'dashboard_stats_cache' });
  const { data: notifications } = useApi(['dashboard-notifications'], '/api/dashboard/notifications', { enabled, staleTime: 60 * 1000, cacheKey: 'dashboard_notifications_cache' });

  // AI Forecast Fetch
  useEffect(() => {
    if (!user?.token) return;
    setIsAiLoading(true);
    fetch(`/api/dashboard/service-forecast?range=6+Months`, {
      headers: { 'Authorization': `Bearer ${user.token}`, 'Accept': 'application/json' }
    })
      .then(res => res.json())
      .then(fetched => { setAiData(fetched); setIsAiLoading(false); })
      .catch(() => setIsAiLoading(false));
  }, [user?.token]);

  const growthInsight = useMemo(() => {
    if (!aiData || !aiData.chart_data) return null;
    const series = aiData.chart_data;
    const actuals = series.filter(p => (p[activeTab]?.actual ?? null) !== null);
    const forecasts = series.filter(p => (p[activeTab]?.actual ?? null) === null);
    
    if (!actuals.length || !forecasts.length) return null;
    
    const lastActual = actuals[actuals.length - 1][activeTab].actual;
    const nextForecast = forecasts[0][activeTab].forecast;
    
    const diff = nextForecast - lastActual;
    const pct = ((diff / Math.max(1, lastActual)) * 100).toFixed(1);
    
    return { diff, pct, isGrowth: diff >= 0 };
  }, [aiData, activeTab]);

  const mappedMetrics = (Array.isArray(stats) ? stats : [])
    .filter(stat => !(isStaff && stat.title === "Monthly Revenue"))
    .map(stat => ({
      ...stat,
      icon: Icons[stat.iconName] || LuIcons[stat.iconName] || Icons.FiActivity,
    }));

  const mappedNotifications = (notifications || []).map(notif => ({
    ...notif,
    icon: Icons[notif.iconName] || LuIcons[notif.iconName] || Icons.FiBell,
  }));

  if (isAiLoading || !aiData) {
    return (
      <div className="flex h-96 items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <LuSparkles className="h-10 w-10 text-emerald-500 animate-spin-slow" />
          <span className="text-zinc-500 font-black uppercase tracking-widest text-[10px]">Compiling Predictive Analytics...</span>
        </div>
      </div>
    );
  }

  const { ai_forecast, chart_data } = aiData;

  return (
    <div className="space-y-10 animate-in fade-in duration-700">
      {/* 1. TOP METRIC CARDS */}
      <section className="grid grid-cols-1 gap-4 md:grid-cols-3 2xl:grid-cols-5">
        {mappedMetrics.map((card) => (
          <MetricCard key={card.id || card.title} card={card} />
        ))}
      </section>

      {/* 2. LARGE CONSOLIDATED AI SERVICE FORECAST CONTAINER */}
      <div className="card-shell p-0 overflow-hidden border border-zinc-100 dark:border-zinc-800 shadow-2xl relative">
        <div className="absolute top-0 right-0 w-96 h-96 bg-purple-500/5 blur-[120px] pointer-events-none rounded-full" />
        
        <div className="bg-white dark:bg-zinc-900 p-8 border-b border-zinc-100 dark:border-zinc-800">
            <div className="flex flex-wrap items-center justify-between gap-8">
                <div>
                    <h2 className="text-2xl font-black tracking-tight text-zinc-900 dark:text-zinc-100 flex items-center gap-3">
                        <div className="h-8 w-8 bg-purple-500 rounded-lg flex items-center justify-center text-white shadow-lg shadow-purple-500/20">
                            <LuSparkles className="h-5 w-5" />
                        </div>
                        AI Service Demand Forecast
                    </h2>
                    <p className="text-xs font-bold text-zinc-500 uppercase tracking-[0.2em] mt-2 ml-11">Multi-category volume projection engine</p>
                </div>
                
                <div className="flex flex-wrap items-center gap-2 bg-zinc-50 dark:bg-zinc-900/50 p-1.5 rounded-2xl border border-zinc-100 dark:border-zinc-800 overflow-x-auto">
                    {SERVICE_LIST.map(service => (
                        <ServiceTab 
                            key={service} name={service} color={COLORS[service]}
                            active={activeTab === service} onClick={setActiveTab}
                        />
                    ))}
                </div>
            </div>
        </div>

        <div className="p-8 lg:p-12 flex flex-col xl:flex-row gap-12">
            <div className="flex-1 w-full space-y-8">
                <div className="flex items-center justify-between">
                    <div>
                        <h3 className="text-lg font-black text-zinc-900 dark:text-zinc-100 uppercase tracking-tight">Demand Trend</h3>
                        <p className="text-[10px] font-black text-zinc-400 uppercase tracking-widest flex items-center gap-2 mt-1">
                            <span className="h-1 w-3 bg-zinc-600 rounded-full" /> Historical
                            <span className="h-1 w-3 bg-purple-500 rounded-full" /> Forecasted
                        </p>
                    </div>
                </div>
                
                <div className="bg-zinc-50/50 dark:bg-black/20 p-8 rounded-[40px] border border-zinc-100 dark:border-zinc-800/50 shadow-inner">
                    <ColumnChart data={chart_data} service={activeTab} color={COLORS[activeTab]} />
                </div>

                {growthInsight && (
                    <div className="flex items-center gap-6 bg-white dark:bg-zinc-800/50 p-6 rounded-3xl border border-zinc-100 dark:border-zinc-800 shadow-sm relative overflow-hidden group">
                        <div className={clsx("absolute inset-y-0 left-0 w-1.5", growthInsight.isGrowth ? "bg-emerald-500" : "bg-rose-500")} />
                        <div className={clsx("h-12 w-12 rounded-2xl flex items-center justify-center text-white shadow-lg transition-transform group-hover:scale-110 duration-500", growthInsight.isGrowth ? "bg-emerald-500 shadow-emerald-500/20" : "bg-rose-500 shadow-rose-500/20")}>
                            <FiTrendingUp className={clsx("h-6 w-6", !growthInsight.isGrowth && "rotate-180")} />
                        </div>
                        <div>
                            <p className="text-[10px] font-black text-zinc-400 uppercase tracking-widest">Prediction Outcome</p>
                            <p className="text-lg font-bold text-zinc-800 dark:text-zinc-200">
                                Demand is projected to <span className={clsx("font-black", growthInsight.isGrowth ? "text-emerald-500" : "text-rose-500")}>
                                    {growthInsight.isGrowth ? 'increase' : 'decrease'} by {Math.abs(growthInsight.pct)}%
                                </span> compared to last month.
                            </p>
                        </div>
                    </div>
                )}
            </div>

            <div className="w-full xl:w-[450px] space-y-8">
                <div className="space-y-6">
                    <div className="relative group overflow-hidden bg-zinc-900 p-10 rounded-[40px] border border-zinc-700 shadow-2xl transition-all duration-500 hover:-translate-y-1">
                        <div className="absolute top-0 right-0 p-6 opacity-5 group-hover:opacity-10 transition-opacity">
                            <FiActivity size={120} className="text-white" />
                        </div>
                        <div className="relative z-10">
                            <p className="text-[10px] font-black text-zinc-400 uppercase tracking-[0.3em] mb-3">Estimated Revenue</p>
                            <p className="text-6xl font-black text-white tracking-tighter">₱{ai_forecast.estimated_revenue.toLocaleString()}</p>
                            <div className="mt-8 flex items-center gap-2 text-emerald-400 text-xs font-black bg-emerald-500/10 w-fit px-4 py-2 rounded-full border border-emerald-500/20 uppercase tracking-widest">
                                <FiArrowUpRight /> Unified Growth Projection
                            </div>
                        </div>
                    </div>

                    <div className="bg-white dark:bg-zinc-800 border-2 border-zinc-100 dark:border-zinc-700/50 p-10 rounded-[40px] shadow-sm relative group overflow-hidden">
                        <div className="absolute top-0 right-0 p-8 opacity-0 group-hover:opacity-10 transition-all duration-700">
                            <FiUsers size={60} className="text-purple-500" />
                        </div>
                        <div className="flex flex-col gap-1">
                            <p className="text-[10px] font-black text-zinc-400 uppercase tracking-[0.3em]">Projected Clients</p>
                            <p className="text-4xl font-black text-zinc-900 dark:text-zinc-50">{ai_forecast.estimated_customers}</p>
                        </div>
                        <p className="mt-6 text-xs font-medium text-zinc-500 leading-relaxed border-t border-zinc-100 dark:border-zinc-700 pt-6">
                            Clinic workload analysis suggests these core categories will be the primary drivers for client visits in the next forecasted cycle.
                        </p>
                    </div>

                    <div className="p-8 bg-zinc-50 dark:bg-zinc-900/50 border border-zinc-100 dark:border-zinc-800 rounded-[40px] flex items-start gap-5">
                        <div className="w-12 h-12 rounded-2xl bg-zinc-200 dark:bg-zinc-800 flex items-center justify-center text-zinc-500 shrink-0">
                            <FiActivity className="w-6 h-6" />
                        </div>
                        <div className="flex-1">
                            <div className="flex justify-between items-center mb-2">
                                <p className="text-[10px] font-black text-zinc-400 uppercase tracking-[0.2em]">Demand Coverage</p>
                                <div className="px-2 py-0.5 bg-zinc-200 dark:bg-zinc-700 rounded text-[9px] font-black text-zinc-900 dark:text-zinc-100 uppercase tracking-widest">
                                    ~{ai_forecast.others_forecast} units
                                </div>
                            </div>
                            <p className="text-[11px] font-medium text-zinc-600 dark:text-zinc-400 leading-relaxed italic">
                                "Other services such as Preventive Care are included in total service demand and grouped under 'Others' for clearer forecasting analysis."
                            </p>
                        </div>
                    </div>
                </div>
            </div>
        </div>

        <div className="bg-zinc-50 dark:bg-zinc-900/50 p-8 border-t border-zinc-100 dark:border-zinc-800">
            <RecentNotificationsCard items={mappedNotifications} />
        </div>
      </div>
    </div>
  );
}

export default DashboardPage;
