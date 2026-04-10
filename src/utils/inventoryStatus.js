/**
 * Centralized logic for inventory stock status and styles.
 * Thresholds:
 * - Out of Stock: Level = 0
 * - Critical: Level <= 25% of Min Stock Level
 * - Low Stock: Level <= Min Stock Level
 * - Expiring: Expiration date within 30 days
 * - In Stock: Everything else
 */

export const INVENTORY_STATUS = {
  OUT_OF_STOCK: "Out of Stock",
  CRITICAL: "Critical Stock",
  LOW: "Low Stock",
  EXPIRING: "Expiring",
  IN_STOCK: "In Stock",
};

export const isExpiringSoon = (expirationDate) => {
  if (!expirationDate) return false;
  const expDate = new Date(expirationDate);
  const today = new Date();
  const diffTime = expDate - today;
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  return diffDays > 0 && diffDays <= 30;
};

export const getInventoryStatus = (level, min, expirationDate) => {
  const stockLevel = Number(level) || 0;
  const minLevel = Number(min) || 0;
  
  if (stockLevel === 0) return INVENTORY_STATUS.OUT_OF_STOCK;
  
  // Critical is a subset of Low, so check it first
  if (stockLevel <= minLevel * 0.25) return INVENTORY_STATUS.CRITICAL;
  
  if (stockLevel <= minLevel) return INVENTORY_STATUS.LOW;
  
  if (isExpiringSoon(expirationDate)) return INVENTORY_STATUS.EXPIRING;
  
  return INVENTORY_STATUS.IN_STOCK;
};

export const getStatusStyles = (status) => {
  const styles = {
    [INVENTORY_STATUS.OUT_OF_STOCK]: "border-rose-300 bg-rose-50 text-rose-700 dark:border-rose-900/50 dark:bg-rose-950/30 dark:text-rose-400 font-black tracking-tight",
    [INVENTORY_STATUS.CRITICAL]: "border-orange-300 bg-orange-50 text-orange-700 dark:border-orange-900/50 dark:bg-orange-950/30 dark:text-orange-400 font-bold",
    [INVENTORY_STATUS.LOW]: "border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-800 dark:bg-amber-900/30 dark:text-amber-400",
    [INVENTORY_STATUS.EXPIRING]: "border-rose-200 bg-rose-50 text-rose-700 dark:border-rose-800 dark:bg-rose-900/30 dark:text-rose-400",
    [INVENTORY_STATUS.IN_STOCK]: "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-400",
  };
  
  return styles[status] || "border-slate-200 bg-slate-50 text-slate-700 dark:border-dark-border dark:bg-dark-surface dark:text-zinc-300";
};
