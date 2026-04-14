import { useState, useEffect } from "react";
import * as Icons from "react-icons/fi";
import { LuSparkles } from "react-icons/lu";
import api from "../../utils/api";
import { useAuth } from "../../context/AuthContext";
import clsx from "clsx";

function AiAppointmentIntelligence() {
    const [aiResponse, setAiResponse] = useState(null);
    const [isLoading, setIsLoading] = useState(true);
    const [hasError, setHasError] = useState(false);
    const { user } = useAuth();

    useEffect(() => {
        let isMounted = true;
        if (!user?.token) return;
        
        setIsLoading(true);
        api.get("/api/dashboard/appointment-forecast")
            .then(res => {
                if (!isMounted) return;
                setAiResponse(res.data);
                setIsLoading(false);
                setHasError(false);
            })
            .catch(err => {
                if (!isMounted) return;
                console.error("Failed to fetch appointment intelligence:", err);
                setAiResponse(null);
                setIsLoading(false);
                setHasError(true);
            });

        return () => {
            isMounted = false;
        };
    }, [user?.token]);

    if (isLoading) {
        return (
            <div className="card-shell p-6 h-full flex items-center justify-center animate-pulse">
                <span className="text-xs font-black uppercase tracking-widest text-slate-400">Analyzing patterns...</span>
            </div>
        );
    }

    if (hasError) {
        return (
            <div className="card-shell p-6 h-full flex flex-col items-center justify-center text-center border-dashed border-2 border-slate-200 dark:border-zinc-800">
                <Icons.FiAlertCircle className="w-8 h-8 text-rose-300 mb-2 animate-pulse" />
                <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Intelligence Offline</p>
                <p className="mt-1 text-[9px] text-slate-500 max-w-[140px]">Unable to project patterns at this time.</p>
            </div>
        );
    }

    if (!aiResponse) return null;

    const { data, interpretation, recommendations, anomaly } = aiResponse;

    return (
        <section className="card-shell p-6 relative overflow-hidden h-full border border-slate-100 dark:border-zinc-800 shadow-soft-xl">
            <div className="flex items-center gap-3 mb-6">
                <div className="p-2 rounded-xl bg-indigo-50 dark:bg-indigo-900/20 text-indigo-600 dark:text-indigo-400">
                    <Icons.FiCalendar className="w-5 h-5" />
                </div>
                <div>
                    <h3 className="text-lg font-black tracking-tight text-slate-800 dark:text-zinc-50">Booking Intelligence</h3>
                    <p className="text-[10px] font-black text-slate-400 dark:text-zinc-500 uppercase tracking-widest">Appointment Pattern Analysis</p>
                </div>
                <div className="ml-auto">
                    <LuSparkles className="w-5 h-5 text-indigo-400 opacity-50" />
                </div>
            </div>

            <div className="grid grid-cols-2 gap-3 mb-6">
                <div className="p-4 rounded-2xl bg-slate-50 dark:bg-zinc-900/40 border border-slate-100 dark:border-zinc-800/50">
                    <p className="text-[9px] font-black uppercase tracking-widest text-slate-400 dark:text-zinc-500 mb-1">Peak Day</p>
                    <p className="text-lg font-black text-slate-800 dark:text-zinc-100">{data.peak_day}</p>
                </div>
                <div className="p-4 rounded-2xl bg-slate-50 dark:bg-zinc-900/40 border border-slate-100 dark:border-zinc-800/50">
                    <p className="text-[9px] font-black uppercase tracking-widest text-slate-400 dark:text-zinc-500 mb-1">Peak Time</p>
                    <p className="text-lg font-black text-slate-800 dark:text-zinc-100">{data.peak_hour}</p>
                </div>
            </div>

            <div className="space-y-4">
                <div className="p-4 rounded-2xl bg-indigo-50/50 dark:bg-indigo-900/10 border border-indigo-100/50 dark:border-indigo-800/30">
                    <p className="text-xs font-bold text-indigo-900 dark:text-indigo-300 leading-relaxed">
                        {interpretation}
                    </p>
                </div>

                {anomaly?.detected && (
                    <div className="flex items-start gap-3 p-3 rounded-xl bg-amber-50 dark:bg-amber-900/20 border border-amber-100 dark:border-amber-800/30">
                        <Icons.FiAlertCircle className="w-4 h-4 text-amber-600 mt-0.5 shrink-0" />
                        <p className="text-xs font-bold text-amber-800 dark:text-amber-300 italic">{anomaly.explanation}</p>
                    </div>
                )}

                <div className="space-y-2">
                    <h4 className="text-[9px] font-black uppercase tracking-widest text-slate-400 dark:text-zinc-600 mb-2 px-1">Recommendations</h4>
                    {recommendations.map((rec, i) => (
                        <div key={i} className="flex items-start gap-3 p-3 rounded-xl bg-white dark:bg-zinc-800/50 border border-slate-100 dark:border-zinc-800 shadow-sm">
                            <div className="mt-1.5 h-1.5 w-1.5 rounded-full bg-indigo-500 shrink-0" />
                            <p className="text-[11px] font-bold text-slate-700 dark:text-zinc-300">{rec}</p>
                        </div>
                    ))}
                </div>
            </div>

            <div className="mt-6 pt-4 border-t border-slate-100 dark:border-zinc-800 shadow-sm flex flex-col gap-2">
                <p className="text-[9px] text-center text-slate-400 italic">
                    {aiResponse.data_basis || "Forecast is based on historical booking patterns."}
                </p>
                {aiResponse.confidence_note && (
                    <p className="text-[9px] font-bold text-center text-slate-400 dark:text-zinc-500 uppercase tracking-widest flex items-center justify-center gap-1 mt-1">
                        <Icons.FiShield className="w-3 h-3 flex-shrink-0" />
                        Defense Note: {aiResponse.confidence_note}
                    </p>
                )}
            </div>
        </section>
    );
}

export default AiAppointmentIntelligence;
