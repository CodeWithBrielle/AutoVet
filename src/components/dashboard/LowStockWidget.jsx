import { useEffect, useState } from "react";
import { FiAlertTriangle } from "react-icons/fi";

function LowStockWidget() {
  const [lowStockItems, setLowStockItems] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/inventory/low-stock")
      .then((res) => res.json())
      .then((data) => {
        setLowStockItems(data);
        setLoading(false);
      })
      .catch((err) => {
        console.error("Failed to fetch low stock items:", err);
        setLoading(false);
      });
  }, []);

  if (loading) {
    return (
      <div className="card-shell p-5 animate-pulse">
        <div className="h-6 w-1/2 bg-slate-200 dark:bg-zinc-700 rounded mb-4"></div>
        <div className="space-y-3">
          <div className="h-4 w-full bg-slate-200 dark:bg-zinc-700 rounded"></div>
          <div className="h-4 w-full bg-slate-200 dark:bg-zinc-700 rounded"></div>
        </div>
      </div>
    );
  }

  if (lowStockItems.length === 0) {
    return null;
  }

  return (
    <div className="card-shell p-0 overflow-hidden mb-6">
      <div className="border-b border-rose-100 bg-rose-50 px-5 py-4 dark:border-rose-900/50 dark:bg-rose-900/20">
        <div className="flex items-center gap-2">
          <FiAlertTriangle className="h-5 w-5 text-rose-500" />
          <h3 className="font-bold text-rose-700 dark:text-rose-400">Low Stock Alerts</h3>
        </div>
      </div>
      <div className="divide-y divide-slate-100 dark:divide-dark-border">
        {lowStockItems.map((item) => (
          <div key={item.id} className="flex items-center justify-between px-5 py-3 hover:bg-slate-50 dark:hover:bg-dark-surface/50 transition">
            <div className="min-w-0 pr-4">
              <p className="truncate text-sm font-semibold text-slate-900 dark:text-zinc-50">{item.item_name}</p>
              <p className="truncate text-xs text-slate-500 dark:text-zinc-400">{item.sku}</p>
            </div>
            <div className="text-right shrink-0">
              <span className="inline-flex rounded-full bg-rose-100 px-2 py-1 text-xs font-semibold text-rose-700 dark:bg-rose-900/30 dark:text-rose-400">
                {item.stock_level} Left
              </span>
              <p className="text-[10px] text-slate-500 dark:text-zinc-500 mt-0.5">Min: {item.min_stock_level}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export default LowStockWidget;
