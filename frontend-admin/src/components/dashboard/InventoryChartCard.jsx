import { useState, useEffect } from "react";
import { LuSparkles } from "react-icons/lu";
import * as Icons from "react-icons/fi";
import { formatCurrency, formatCurrencyShort } from "../../utils/formatters";
import clsx from "clsx";
import api from "../../utils/api";
import { useAuth } from "../../context/AuthContext";

const WIDTH = 760;
const HEIGHT = 320;
const PADDING_X = 24;
const PADDING_Y = 24;

function createPath(points) {
  if (!points.length) return "";
  return points
    .map((point, index) => `${index === 0 ? "M" : "L"}${point.x.toFixed(2)},${point.y.toFixed(2)}`)
    .join(" ");
}

function InventoryChartCard() {
  const [activeRange, setActiveRange] = useState("6_months");
  const [data, setData] = useState([]);
  const [aiResponse, setAiResponse] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [hasError, setHasError] = useState(false);

  const { user } = useAuth();

  useEffect(() => {
    let isMounted = true;
    if (!user?.token) return;
    
    // Show loading only on initial fetch or when range explicitly changes
    if (data.length === 0) setIsLoading(true);
    
    api.get(`/api/dashboard/inventory-consumption?range=${activeRange}`)
      .then(res => {
        if (!isMounted) return;
        setHasError(false);
        setAiResponse(res.data);
        setData(res.data?.data || []);
        setIsLoading(false);
      })
      .catch(err => {
        if (!isMounted) return;
        console.error("Failed to fetch inventory data:", err);
        setHasError(true);
        setData([]);
        setAiResponse({
            label_mode: "overview",
            interpretation: "Analytics currently offline.",
            recommendations: [],
            data_basis: "System Error"
        });
        setIsLoading(false);
      });

    return () => {
      isMounted = false;
    };
  }, [activeRange, user?.token]);

  if (isLoading) {
    return (
      <section className="card-shell flex min-h-[460px] items-center justify-center p-6 border-dashed border-2 dark:border-dark-border">
        <span className="text-zinc-400 dark:text-zinc-500 font-medium">Loading Inventory Data...</span>
      </section>
    );
  }

  const safeData = Array.isArray(data) ? data : [];

  if (hasError || safeData.length === 0) {
    return (
      <section className="card-shell flex min-h-[460px] flex-col items-center justify-center p-6 text-center border-dashed border-2 border-slate-200 dark:border-dark-border">
        <div className="h-16 w-16 rounded-full bg-slate-50 flex items-center justify-center mb-4 dark:bg-dark-surface">
          {hasError ? (
             <Icons.FiAlertCircle className="h-8 w-8 text-rose-300 animate-pulse" />
          ) : (
             <Icons.FiCircle className="h-8 w-8 text-slate-300 animate-pulse" />
          )}
        </div>
        <h3 className="text-lg font-bold text-slate-800 dark:text-zinc-100 italic">
          {hasError ? "Analytics Unavailable" : "Insufficient Historical Data"}
        </h3>
        <p className="mt-2 max-w-xs text-sm text-slate-500 dark:text-zinc-400">
          {hasError ? "Unable to retrieve usage data at this time. Please check your connection or try again later." : "At least two months of inventory transaction history is needed to generate consumption trends and AI forecasts."}
        </p>
      </section>
    );
  }
  const allValues = safeData.flatMap((entry) => [entry.actual, entry.forecast]).filter((value) => value !== null);

  const min = allValues.length ? Math.min(...allValues) * 0.9 : 0;
  const max = allValues.length ? Math.max(...allValues) * 1.1 : 100;
  const span = Math.max(max - min, 1);

  const xStep = safeData.length > 1 ? (WIDTH - PADDING_X * 2) / (safeData.length - 1) : 0;

  const toY = (value) => HEIGHT - PADDING_Y - ((value - min) / span) * (HEIGHT - PADDING_Y * 2);

  const forecastPoints = safeData.map((entry, index) => ({
    x: PADDING_X + xStep * index,
    y: toY(entry.forecast),
  }));


  const actualPoints = safeData
    .map((entry, index) => (entry.actual === null ? null : { x: PADDING_X + xStep * index, y: toY(entry.actual) }))
    .filter(Boolean);


  const latestActualPoint = actualPoints.length > 0 ? actualPoints[actualPoints.length - 1] : null;
  const latestActualValue = safeData.filter((entry) => entry.actual !== null).at(-1)?.actual;


  const numGridLines = 5;
  const gridLines = Array.from({ length: numGridLines }).map((_, i) => {
    const ratio = i / (numGridLines - 1);
    const value = Math.round(min + (max - min) * ratio);
    const y = toY(value);
    return { y, label: value.toLocaleString() };
  });

  return (
    <section className="card-shell p-8 shadow-soft-xl border border-slate-100 dark:border-zinc-800">
      <div className="mb-8 flex flex-wrap items-center justify-between gap-6">
        <div>
          <h3 className="text-2xl font-black tracking-tight text-slate-800 dark:text-zinc-50">Usage Analysis</h3>
          <p className="mt-1 text-sm font-bold text-slate-400 dark:text-zinc-500 uppercase tracking-widest">
            Inventory Consumption • {aiResponse?.label_mode === 'overview' ? 'Actual Data' : 'Actual vs Prediction'}
          </p>
        </div>
        <div className="flex items-center gap-1 rounded-2xl bg-slate-100/80 p-1 dark:bg-zinc-800/40">
          <button
            onClick={() => setActiveRange("6_months")}
            className={clsx(
              "rounded-xl px-5 py-2.5 text-xs font-black uppercase tracking-widest transition-all",
              activeRange === "6_months"
                ? "bg-white text-slate-900 shadow-sm dark:bg-zinc-900 dark:text-zinc-50"
                : "text-slate-500 hover:text-slate-700 dark:text-zinc-400 dark:hover:text-zinc-200"
            )}
          >
            6M
          </button>
          <button
            onClick={() => setActiveRange("12_months")}
            className={clsx(
              "rounded-xl px-5 py-2.5 text-xs font-black uppercase tracking-widest transition-all",
              activeRange === "12_months"
                ? "bg-white text-slate-900 shadow-sm dark:bg-zinc-900 dark:text-zinc-50"
                : "text-slate-500 hover:text-slate-700 dark:text-zinc-400 dark:hover:text-zinc-200"
            )}
          >
            1Y
          </button>
        </div>
      </div>

      <div className="mb-8 flex flex-wrap items-center gap-6 text-[10px] font-black uppercase tracking-widest">
        <span className="inline-flex items-center gap-2 text-blue-600 dark:text-blue-400">
          <span className="h-2 w-2 rounded-full bg-blue-600" />
          Actual Usage
        </span>
        {aiResponse?.label_mode !== 'overview' && (
          <span className="inline-flex items-center gap-2 text-slate-400 dark:text-zinc-600">
            <span className="h-2 w-2 rounded-full border-2 border-slate-300 dark:border-zinc-700" />
            AI Forecast
          </span>
        )}
      </div>

      <div className="relative rounded-[2rem] bg-slate-50/50 p-6 dark:bg-zinc-900/20 border border-slate-100 dark:border-zinc-800/50">
        <svg viewBox={`0 0 ${WIDTH} ${HEIGHT}`} className="h-[330px] w-full overflow-visible">
          {/* Grid Lines & Axis Labels */}
          {gridLines.map((line, i) => (
             <g key={i}>
                <line
                  x1={PADDING_X + 40}
                  y1={line.y}
                  x2={WIDTH - PADDING_X}
                  y2={line.y}
                  className="stroke-slate-200 dark:stroke-zinc-800"
                  strokeDasharray="4 4"
                />
                <text x={PADDING_X + 30} y={line.y + 4} textAnchor="end" className="fill-slate-400 dark:fill-zinc-600 text-[10px] font-bold">
                   {line.label}
                </text>
             </g>
          ))}

          {/* Paths */}
          <path d={createPath(forecastPoints)} className="fill-none stroke-slate-300 dark:stroke-zinc-700" strokeWidth="3" strokeDasharray="8 8" />
          <path d={createPath(actualPoints)} className="fill-none stroke-blue-600 drop-shadow-md" strokeWidth="5" strokeLinecap="round" strokeLinejoin="round" />

          {/* Data Nodes */}
          {actualPoints.map((p, i) => (
             <circle key={i} cx={p.x} cy={p.y} r="3" className="fill-white stroke-blue-600 stroke-2" />
          ))}

          {latestActualPoint ? (
            <g transform={`translate(${latestActualPoint.x - 44}, ${latestActualPoint.y - 60})`}>
              <rect width="88" height="40" rx="12" className="fill-slate-900 dark:fill-zinc-800 shadow-xl" />
              <text x="44" y="27" textAnchor="middle" className="fill-white text-[12px] font-black tracking-tight">
                {latestActualValue?.toLocaleString()}
              </text>
              <text x="44" y="14" textAnchor="middle" className="fill-slate-400 text-[8px] font-black uppercase tracking-widest">
                LATEST
              </text>
            </g>
          ) : null}
        </svg>

        {/* X Axis Labels */}
        <div className="mt-6 flex items-center justify-between px-10">
           {safeData.map((entry, i) => (
             <span key={i} className="text-[10px] font-black uppercase tracking-widest text-slate-400 dark:text-zinc-600">
                {entry.month}
             </span>
           ))}
        </div>
      </div>

      {aiResponse && !isLoading && data.length > 0 && (
        <div className="mt-8 space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-700">
          {/* Interpretation Layer */}
          <div className="rounded-2xl bg-blue-50/50 p-6 border border-blue-100/50 dark:bg-blue-900/10 dark:border-blue-800/30">
            <div className="flex items-center gap-2 mb-3">
              <div className="p-1.5 rounded-lg bg-blue-100 dark:bg-blue-900/40 text-blue-600 dark:text-blue-400">
                <LuSparkles className="w-4 h-4" />
              </div>
              <h4 className="text-xs font-black uppercase tracking-widest text-blue-800 dark:text-blue-300">
                {aiResponse.label_mode === 'overview' ? 'Usage Overview' : 'Usage Analysis'}
              </h4>
            </div>
            <p className="text-sm font-medium text-slate-700 dark:text-zinc-300 leading-relaxed">
              {aiResponse.interpretation}
            </p>
            {aiResponse.anomaly?.detected && (
              <div className="mt-4 flex items-start gap-3 p-3 rounded-xl bg-orange-50 dark:bg-orange-900/20 border border-orange-100 dark:border-orange-800/30">
                <Icons.FiAlertTriangle className="w-4 h-4 text-orange-600 mt-0.5" />
                <div className="space-y-1">
                  <p className="text-[10px] font-black uppercase tracking-widest text-orange-700 dark:text-orange-400">Abnormal Pattern Detected</p>
                  <p className="text-xs text-orange-800/80 dark:text-orange-300/80">{aiResponse.anomaly.explanation}</p>
                </div>
              </div>
            )}
          </div>

          {/* Recommendations / Depletion Layer */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-4">
              <h4 className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 dark:text-zinc-600 flex items-center gap-2">
                <Icons.FiShoppingBag className="w-3 h-3" />
                Reorder Suggestions
              </h4>
              <div className="space-y-2">
                {aiResponse.recommendations?.map((rec, i) => (
                  <div key={i} className={clsx(
                    "flex items-start gap-3 p-4 rounded-xl border shadow-sm",
                    rec.includes("CRITICAL") || rec.includes("OUT OF STOCK") 
                      ? "bg-rose-50/50 border-rose-100 dark:bg-rose-900/10 dark:border-rose-800/30" 
                      : "bg-white dark:bg-zinc-800/50 border-slate-100 dark:border-zinc-800"
                  )}>
                    <div className={clsx(
                      "mt-1.5 h-1.5 w-1.5 rounded-full shrink-0",
                      rec.includes("CRITICAL") || rec.includes("OUT OF STOCK") ? "bg-rose-500" : "bg-blue-500"
                    )} />
                    <p className={clsx(
                      "text-xs font-bold",
                      rec.includes("CRITICAL") || rec.includes("OUT OF STOCK") ? "text-rose-900 dark:text-rose-300" : "text-slate-700 dark:text-zinc-300"
                    )}>{rec}</p>
                  </div>
                ))}
              </div>
            </div>

            <div className="flex flex-col justify-end p-6 rounded-2xl border border-dashed border-slate-200 dark:border-zinc-800 bg-slate-50/30 dark:bg-zinc-900/10">
              <div className="space-y-4">
                <div>
                  <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 dark:text-zinc-500 mb-1">Data Basis</p>
                  <p className="text-[11px] font-bold text-slate-600 dark:text-zinc-400">{aiResponse.data_basis}</p>
                </div>
                {aiResponse.confidence_note && (
                  <div className="pt-4 border-t border-slate-100 dark:border-zinc-800">
                    <p className="text-[9px] font-bold text-slate-400 dark:text-zinc-500 uppercase tracking-widest flex items-start gap-1">
                      <Icons.FiShield className="w-3 h-3 flex-shrink-0 mt-0.5" />
                      Defense Note: {aiResponse.confidence_note}
                    </p>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}

export default InventoryChartCard;
