import { useEffect, useState } from "react";
import InventoryChartCard from "../components/dashboard/InventoryChartCard";
import MetricCard from "../components/dashboard/MetricCard";
import RecentNotificationsCard from "../components/dashboard/RecentNotificationsCard";
import AiSalesForecastCard from "../components/dashboard/AiSalesForecastCard";
import { apiFetch } from "../utils/api-client";

function DashboardPage() {
  const [apiStatus, setApiStatus] = useState(null);

  // These states are ready to be populated from your Laravel API
  const [metrics, setMetrics] = useState([]);
  const [inventory, setInventory] = useState([]);
  const [notifications, setNotifications] = useState([]);

  useEffect(() => {
    apiFetch("/api/status")
      .then((res) => res.json())
      .then((data) => setApiStatus(data))
      .catch((err) => console.error("API Fetch Error:", err));

    apiFetch("/api/reports/dashboard")
      .then((res) => res.json())
      .then((data) => {
          if (data.status === 'success') {
              const stats = data.data;
              const currentMonthRev = stats.monthly_revenue.length > 0 ? stats.monthly_revenue[stats.monthly_revenue.length - 1].revenue : 0;
              const topProduct = stats.top_products.length > 0 ? stats.top_products[0].name : 'N/A';
              const topProductSold = stats.top_products.length > 0 ? stats.top_products[0].total_sold : 0;
              
              setMetrics([
                  {
                      id: 1,
                      title: "Monthly Revenue",
                      value: new Intl.NumberFormat('en-PH', { style: 'currency', currency: 'PHP', maximumFractionDigits: 0 }).format(currentMonthRev),
                      detail: "Current month earnings",
                      iconBg: "bg-emerald-100 dark:bg-emerald-900/30",
                      iconColor: "text-emerald-600 dark:text-emerald-400",
                      icon: () => <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>,
                      accentBorder: "border-b-4 border-emerald-500",
                  },
                  {
                      id: 2,
                      title: "Appointments",
                      value: stats.appointment_count,
                      detail: "Scheduled this month",
                      iconBg: "bg-blue-100 dark:bg-blue-900/30",
                      iconColor: "text-blue-600 dark:text-blue-400",
                      icon: () => <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"></path></svg>,
                      accentBorder: "border-b-4 border-blue-500",
                  },
                  {
                      id: 3,
                      title: "Top Product",
                      value: topProduct,
                      detail: `${topProductSold} units sold total`,
                      iconBg: "bg-amber-100 dark:bg-amber-900/30",
                      iconColor: "text-amber-600 dark:text-amber-400",
                      icon: () => <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7"></path></svg>,
                      accentBorder: "border-b-4 border-amber-500",
                  }
              ]);
          }
      })
      .catch((err) => console.error("API Fetch Error:", err));

  }, []);

  return (
    <div className="space-y-6">
      {apiStatus && (
        <div className="flex items-center gap-2 rounded-xl bg-emerald-50 px-4 py-3 text-sm font-medium text-emerald-800 border border-emerald-200 dark:bg-emerald-900/20 dark:border-emerald-800 dark:text-emerald-400">
          <span className="flex h-2.5 w-2.5 rounded-full bg-emerald-500 ring-4 ring-emerald-100 dark:ring-emerald-900" />
          {apiStatus.message}
        </div>
      )}
      <section className="grid grid-cols-1 gap-4 md:grid-cols-2 2xl:grid-cols-4">
        {metrics.map((card) => (
          <MetricCard key={card.id} card={card} />
        ))}
        {metrics.length === 0 && (
          <div className="col-span-1 md:col-span-2 2xl:col-span-4 flex min-h-[140px] items-center justify-center rounded-2xl border-2 border-dashed border-slate-200 text-slate-400 dark:border-gray-700 dark:text-gray-500">
            No metrics loaded yet...
          </div>
        )}
      </section>

      <section className="grid grid-cols-1 gap-6 2xl:grid-cols-[2fr_1fr]">
        <div className="space-y-6">
          <AiSalesForecastCard />
          <InventoryChartCard data={inventory} />
        </div>
        <RecentNotificationsCard items={notifications} />
      </section>
    </div>
  );
}

export default DashboardPage;
