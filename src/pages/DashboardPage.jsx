import { useEffect, useState } from "react";
import InventoryChartCard from "../components/dashboard/InventoryChartCard";
import MetricCard from "../components/dashboard/MetricCard";
import RecentNotificationsCard from "../components/dashboard/RecentNotificationsCard";
import AiSalesForecastCard from "../components/dashboard/AiSalesForecastCard";
import AiAppointmentIntelligence from "../components/dashboard/AiAppointmentIntelligence";
import ErrorBoundary from "../components/ErrorBoundary";
import * as Icons from "react-icons/fi";
import { useAuth } from "../context/AuthContext";
import { ROLES } from "../constants/roles";
import api from "../utils/api";

function DashboardPage() {
  const [apiStatus, setApiStatus] = useState(null);
  const [metrics, setMetrics] = useState([]);
  const [notifications, setNotifications] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const { user } = useAuth();
  const isStaff = user?.role === ROLES.STAFF;

  useEffect(() => {
    let isMounted = true;
    if (!user?.token) return;
    setIsLoading(true);

    Promise.all([
      api.get("/api/status").catch(() => ({ data: { message: "Status offline" } })),
      api.get("/api/dashboard/stats").catch(() => ({ data: [] })),
      api.get("/api/dashboard/notifications").catch(() => ({ data: [] }))
    ])
      .then(([statusRes, statsRes, notifRes]) => {
        if (!isMounted) return;
        const status = statusRes.data;
        const statsData = statsRes.data;
        const notifData = notifRes.data;

        setApiStatus(status);
        
        const safeStats = Array.isArray(statsData) ? statsData : [];
        if (safeStats.length > 0) {
          const mappedMetrics = safeStats
            .filter(stat => !(isStaff && stat.title === "Monthly Revenue"))
            .map(stat => ({
              ...stat,
              icon: Icons[stat.iconName] || Icons.FiActivity
            }));
          setMetrics(mappedMetrics);
        }

        const safeNotifs = Array.isArray(notifData) ? notifData : [];
        if (safeNotifs.length > 0) {
          const mappedNotifs = safeNotifs.map(notif => ({
            ...notif,
            icon: Icons[notif.iconName] || Icons.FiBell
          }));
          setNotifications(mappedNotifs);
        }
        
        setIsLoading(false);
      })
      .catch((err) => {
        if (!isMounted) return;
        console.error("Dashboard Fetch Error:", err);
        setIsLoading(false);
      });

    return () => {
      isMounted = false;
    };
  }, [user?.token]);

  const handleMarkAllRead = () => {
    // Persistent backend update
    api.post("/api/notifications/mark-as-read", { all: true })
      .catch(err => console.error("Failed to mark all as read:", err));
    
    // Immediate UI update
    setNotifications([]);
  };

  const handleDismissNotification = (id) => {
    const notif = notifications.find(n => n.id === id);
    if (notif?.db_id) {
      // Persistent backend update for specific notification
      api.post("/api/notifications/mark-as-read", { notification_ids: [notif.db_id] })
        .catch(err => console.error("Failed to dismiss notification:", err));
    }
    
    // Immediate UI update
    setNotifications(prev => prev.filter(n => n.id !== id));
  };

  if (isLoading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <div className="text-slate-500 dark:text-zinc-400 font-medium">Loading Dashboard Data...</div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {apiStatus && (
        <div className="flex items-center gap-2 rounded-xl bg-emerald-50 px-4 py-3 text-sm font-medium text-emerald-800 border border-emerald-200 dark:bg-emerald-900/20 dark:border-emerald-800 dark:text-emerald-400">
          <span className="flex h-2.5 w-2.5 rounded-full bg-emerald-500 ring-4 ring-emerald-100 dark:ring-emerald-900" />
          {apiStatus.message}
        </div>
      )}
      <section className="grid grid-cols-1 gap-4 md:grid-cols-3 2xl:grid-cols-5">
        {metrics.map((card) => (
          <MetricCard key={card.id} card={card} />
        ))}
      </section>

      <section className="grid grid-cols-1 gap-6 2xl:grid-cols-[2fr_1fr]">
        <div className="space-y-6">
          {!isStaff && (
            <ErrorBoundary label="Sales Forecast">
              <AiSalesForecastCard />
            </ErrorBoundary>
          )}
          <ErrorBoundary label="Inventory Consumption">
            <InventoryChartCard />
          </ErrorBoundary>
        </div>
        <div className="space-y-6">
          <ErrorBoundary label="Appointment Intelligence">
            <AiAppointmentIntelligence />
          </ErrorBoundary>
          <ErrorBoundary label="Recent Notifications">
            <RecentNotificationsCard
              items={notifications}
              onMarkAllRead={handleMarkAllRead}
              onDismiss={handleDismissNotification}
            />
          </ErrorBoundary>
        </div>
      </section>
    </div>
  );
}

export default DashboardPage;
