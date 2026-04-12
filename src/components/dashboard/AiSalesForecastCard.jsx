import { useState, useEffect } from "react";
import { FiCircle } from "react-icons/fi";
import { LuSparkles } from "react-icons/lu";
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

function AiSalesForecastCard() {
    const [activeRange, setActiveRange] = useState("6 Months");
    const [data, setData] = useState([]);
    const [isLoading, setIsLoading] = useState(true);

    const { user } = useAuth();

    useEffect(() => {
        let isMounted = true;
        if (!user?.token) return;
        
        // Show loading only on initial fetch or when range explicitly changes
        if (data.length === 0) setIsLoading(true);
        
        api.get(`/api/dashboard/sales-forecast?range=${activeRange}`)
            .then(res => {
                if (!isMounted) return;
                setData(res.data);
                setIsLoading(false);
            })
            .catch(err => {
                if (!isMounted) return;
                console.error("Failed to fetch forecast:", err);
                // Keep existing data on error, just stop loading
                setIsLoading(false);
            });

        return () => {
            isMounted = false;
        };
    }, [activeRange, user?.token]);

    const safeData = Array.isArray(data) ? data : [];
    const allValues = safeData.flatMap((entry) => [entry.actual, entry.forecast]).filter((value) => value !== null);

    // To avoid NaN when data is empty
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
        return { y, label: formatCurrencyShort(value) };
    });

    return (
        <section className="card-shell p-8 relative overflow-hidden shadow-soft-xl border border-slate-100 dark:border-zinc-800">
            <div className="absolute top-0 right-0 p-6 opacity-10 dark:opacity-5 pointer-events-none">
                <LuSparkles className="w-32 h-32 text-emerald-500" />
            </div>

            <div className="mb-8 flex flex-wrap items-start justify-between gap-6 relative z-10">
                <div>
                    <h3 className="text-2xl font-black tracking-tight text-slate-800 dark:text-zinc-50 flex items-center gap-2">
                        <LuSparkles className="text-emerald-500 w-6 h-6" />
                        Sales Insights
                    </h3>
                    <p className="mt-1 text-sm font-bold text-slate-400 dark:text-zinc-500 uppercase tracking-widest">Revenue Projection • AI Synthesis</p>
                </div>
                <div className="flex items-center gap-1 rounded-2xl bg-slate-100/80 p-1 dark:bg-zinc-800/40">
                    <button
                        onClick={() => setActiveRange("6 Months")}
                        className={clsx(
                            "rounded-xl px-5 py-2.5 text-xs font-black uppercase tracking-widest transition-all",
                            activeRange === "6 Months"
                                ? "bg-white text-slate-900 shadow-sm dark:bg-zinc-900 dark:text-zinc-50"
                                : "text-slate-500 hover:text-slate-700 dark:text-zinc-400 dark:hover:text-zinc-200"
                        )}
                    >
                        6M
                    </button>
                    <button
                        onClick={() => setActiveRange("Year")}
                        className={clsx(
                            "rounded-xl px-5 py-2.5 text-xs font-black uppercase tracking-widest transition-all",
                            activeRange === "Year"
                                ? "bg-white text-slate-900 shadow-sm dark:bg-zinc-900 dark:text-zinc-50"
                                : "text-slate-500 hover:text-slate-700 dark:text-zinc-400 dark:hover:text-zinc-200"
                        )}
                    >
                        1Y
                    </button>
                </div>
            </div>

            <div className="mb-8 flex flex-wrap items-center gap-6 text-[10px] font-black uppercase tracking-widest relative z-10">
                <span className="inline-flex items-center gap-2 text-emerald-600">
                    <span className="h-2 w-2 rounded-full bg-emerald-600" />
                    Actual Revenue
                </span>
                <span className="inline-flex items-center gap-2 text-slate-400 dark:text-zinc-600">
                    <span className="h-2 w-2 rounded-full border-2 border-slate-300 dark:border-zinc-700" />
                    AI Prediction
                </span>
            </div>

            <div className="relative rounded-[2rem] bg-slate-50/50 p-6 dark:bg-zinc-900/20 border border-slate-100 dark:border-zinc-800/50 relative z-10">
                {isLoading ? (
                    <div className="h-[330px] w-full flex items-center justify-center">
                        <div className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 animate-pulse">Synthesizing Data...</div>
                    </div>
                ) : safeData.length === 0 ? (
                    <div className="h-[330px] w-full flex flex-col items-center justify-center text-center px-6">
                        <LuSparkles className="w-12 h-12 text-emerald-300 mb-4 opacity-50" />
                        <h4 className="text-slate-700 dark:text-zinc-200 font-bold italic">Insufficient Data for AI Forecasting</h4>
                        <p className="mt-2 text-xs text-slate-500 dark:text-zinc-500 max-w-[200px]">
                            Once you have recorded sales over several weeks, our algorithm will begin projecting your future revenue.
                        </p>
                    </div>
                ) : (
                    <>
                        <svg viewBox={`0 0 ${WIDTH} ${HEIGHT}`} className="h-[330px] w-full overflow-visible">
                            {/* Grid Lines & Y Axis Labels */}
                            {gridLines.map((line, i) => (
                                <g key={i}>
                                    <line
                                        x1={PADDING_X + 60}
                                        y1={line.y}
                                        x2={WIDTH - PADDING_X}
                                        y2={line.y}
                                        className="stroke-slate-200 dark:stroke-zinc-800"
                                        strokeDasharray="4 4"
                                    />
                                    <text x={PADDING_X + 50} y={line.y + 4} textAnchor="end" className="fill-slate-400 dark:fill-zinc-600 text-[10px] font-bold">
                                        {line.label}
                                    </text>
                                </g>
                            ))}

                            {/* Paths */}
                            <path d={createPath(forecastPoints)} className="fill-none stroke-slate-300 dark:stroke-zinc-700" strokeWidth="3" strokeDasharray="8 8" />
                            <path d={createPath(actualPoints)} className="fill-none stroke-emerald-600 drop-shadow-md" strokeWidth="5" strokeLinecap="round" strokeLinejoin="round" />

                            {/* Data Nodes */}
                            {actualPoints.map((p, i) => (
                                <circle key={i} cx={p.x} cy={p.y} r="3" className="fill-white stroke-emerald-600 stroke-2" />
                            ))}

                            {latestActualPoint ? (
                                <g transform={`translate(${latestActualPoint.x - 50}, ${latestActualPoint.y - 60})`}>
                                    <rect width="100" height="40" rx="12" className="fill-slate-900 dark:fill-zinc-800 shadow-xl" />
                                    <text x="50" y="27" textAnchor="middle" className="fill-white text-[11px] font-black tracking-tight">
                                        {formatCurrency(latestActualValue)}
                                    </text>
                                    <text x="50" y="14" textAnchor="middle" className="fill-slate-400 text-[8px] font-black uppercase tracking-widest">
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
                    </>
                )}
            </div>
        </section>
    );
}

export default AiSalesForecastCard;