import { useState, useEffect } from "react";
import { FiX, FiCheckCircle, FiInfo, FiCheck, FiPackage, FiZap, FiBox, FiActivity } from "react-icons/fi";
import { LuSparkles } from "react-icons/lu";
import { useToast } from "../../context/ToastContext";
import { useForm, useWatch } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import clsx from "clsx";
import { useAuth } from "../../context/AuthContext";
import { getInventoryStatus, getStatusStyles, INVENTORY_STATUS } from "../../utils/inventoryStatus";

const UNIT_OPTIONS = ["", "piece", "vial", "bottle", "tablet", "pack", "box", "dose", "ml", "sachet", "tube"];

const inventorySchema = z.object({
  inventory_category_id: z.coerce.number().min(1, "Category is required"),
  item_name: z.string().min(1, "Item name is required").max(255),
  stock_level: z.coerce.number().min(0, "Quantity must be 0 or more"),
  unit: z.string().min(1, "Unit is required"),
  min_stock_level: z.coerce.number().min(0, "Alert threshold must be 0 or more"),
  
  price: z.coerce.number().min(0, "Price must be 0 or more").optional().or(z.literal("")), 
  cost_price: z.coerce.number().min(0, "Cost price must be 0 or more").optional().or(z.literal("")),
  selling_price: z.coerce.number().min(0, "Selling price is required").optional().or(z.literal("")),
  service_price: z.coerce.number().min(0, "Service price is required").optional().or(z.literal("")),
  
  is_sellable: z.boolean().default(true),
  is_service_usable: z.boolean().default(false),
  deduct_on_finalize: z.boolean().default(true),
  track_expiration: z.boolean().default(false),
  expiration_date: z.string().optional().or(z.literal("")),
  
  supplier: z.string().optional().default("Other"),
  sku: z.string().max(255).optional(),
  sub_details: z.string().max(255).optional(),
  status: z.string().optional(),
}).superRefine((data, ctx) => {
  if (data.track_expiration && !data.expiration_date) {
    ctx.addIssue({
      path: ["expiration_date"],
      message: "Expiration Date is required when Track Expiration is enabled",
      code: z.ZodIssueCode.custom,
    });
  }
  
  if (!data.is_sellable && !data.is_service_usable) {
      ctx.addIssue({
          path: ["is_sellable"],
          message: "Select at least one: Sellable or Service-Usable",
          code: z.ZodIssueCode.custom
      });
  }
});

const SectionHeading = ({ icon: Icon, children }) => (
  <div className="mb-6 mt-8 first:mt-0">
    <div className="flex items-center gap-2 mb-2">
      {Icon && <Icon className="h-4 w-4 text-blue-500" />}
      <h4 className="text-[11px] font-black uppercase tracking-[0.15em] text-slate-400 dark:text-zinc-500">
        {children}
      </h4>
    </div>
    <div className="h-0.5 w-full bg-slate-50 dark:bg-zinc-800/40 rounded-full"></div>
  </div>
);

export default function AddInventoryModal({ isOpen, onClose, onSave }) {
  const toast = useToast();
  const [categoryOptions, setCategoryOptions] = useState([]);
  const { user } = useAuth();

  const {
    register,
    handleSubmit,
    reset,
    setValue,
    watch,
    formState: { errors, isSubmitting },
  } = useForm({
    resolver: zodResolver(inventorySchema),
    defaultValues: {
      inventory_category_id: "",
      item_name: "",
      stock_level: 0,
      unit: "",
      min_stock_level: 10,
      cost_price: 0,
      selling_price: 0,
      service_price: 0,
      is_sellable: true,
      is_service_usable: false,
      deduct_on_finalize: true,
      track_expiration: false,
      expiration_date: "",
      supplier: "Other",
      sku: "",
      sub_details: "",
      status: INVENTORY_STATUS.IN_STOCK
    },
  });

  const watchCategory = watch("inventory_category_id");
  const watchTrackExpiration = watch("track_expiration");
  const initialStock = watch("stock_level") || 0;
  const alertThreshold = watch("min_stock_level") || 0;
  const watchSellable = watch("is_sellable");
  const watchServiceUsable = watch("is_service_usable");
  const watchAutoDeduct = watch("deduct_on_finalize");
  const watchExpDate = watch("expiration_date");

  useEffect(() => {
    if (isOpen && user?.token) {
      fetch("/api/inventory-categories?per_page=1000", {
        headers: {
          Accept: "application/json",
          Authorization: `Bearer ${user.token}`,
        },
      })
        .then((res) => res.json())
        .then((data) => {
          let categories = [];
          if (Array.isArray(data)) categories = data;
          else if (data && Array.isArray(data.data)) categories = data.data;
          setCategoryOptions(categories.filter(c => c.status === "Active" || c.status === "active"));
        })
        .catch(console.error);
    }
  }, [isOpen, user?.token]);

  useEffect(() => {
    if (watchCategory && categoryOptions.length > 0) {
      const cat = categoryOptions.find((c) => c.id == watchCategory);
      if (cat?.name) {
        const name = cat.name.toLowerCase();
        if (name.includes("vaccin")) {
          setValue("unit", "dose");
          setValue("track_expiration", true);
          setValue("is_sellable", false);
          setValue("is_service_usable", true);
          setValue("deduct_on_finalize", true);
        } else if (name.includes("consumable")) {
          setValue("is_sellable", false);
          setValue("is_service_usable", true);
          setValue("selling_price", 0);
          setValue("service_price", 0);
        }
      }
    }
  }, [watchCategory, categoryOptions, setValue]);

  const stockStatus = getInventoryStatus(initialStock, alertThreshold, watchExpDate);
  const statusClasses = getStatusStyles(stockStatus);
  const highThresholdWarning = initialStock > 0 && alertThreshold >= initialStock * 0.9;

  useEffect(() => {
      setValue("status", stockStatus);
  }, [stockStatus, setValue]);

  if (!isOpen) return null;

  const onSubmit = async (data) => {
    try {
      const response = await fetch("/api/inventory", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
          Authorization: `Bearer ${user?.token}`,
        },
        body: JSON.stringify(data),
      });

      if (!response.ok) {
        const err = await response.json();
        throw new Error(err.errors ? Object.values(err.errors)[0][0] : (err.message || "Failed to save."));
      }

      const savedItem = await response.json();
      onSave(savedItem);
      toast.success("Intel record authorized & added.");
      reset(); onClose();
    } catch (err) {
      toast.error(err.message || "Archive failure.");
    }
  };

  const getInputClass = (error) =>
    clsx(
      "w-full rounded-2xl border bg-slate-50/50 px-4 py-3 text-sm font-bold text-slate-800 transition-all focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/20 dark:bg-zinc-900/40 dark:text-zinc-200 dark:placeholder:text-zinc-600",
      error ? "border-rose-400 focus:border-rose-500" : "border-slate-100 focus:border-blue-500 dark:border-zinc-800"
    );

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-sm dark:bg-zinc-950/70 overflow-y-auto">
      <div className="relative w-full max-w-5xl my-8 overflow-hidden rounded-[3rem] bg-white shadow-2xl dark:bg-dark-card border border-white/20">
        
        {/* Modern Header */}
        <div className="bg-slate-50/50 px-10 py-8 dark:bg-dark-surface/10 border-b border-slate-100 dark:border-zinc-800/10">
          <div className="flex items-center justify-between">
            <div>
               <div className="flex items-center gap-2 mb-1">
                  <FiPackage className="h-4 w-4 text-blue-600" />
                  <h3 className="text-[10px] font-black uppercase tracking-[0.25em] text-slate-400 dark:text-zinc-500">Inventory Procurement</h3>
               </div>
               <h2 className="text-3xl font-black text-slate-900 dark:text-zinc-50">Intel Admission</h2>
            </div>
            <button
               onClick={onClose}
               className="rounded-2xl p-3 text-slate-400 hover:bg-slate-200 dark:hover:bg-zinc-800 transition-all active:scale-90"
            >
              <FiX className="h-6 w-6" />
            </button>
          </div>
        </div>

        <form onSubmit={handleSubmit(onSubmit)} className="overflow-hidden bg-white dark:bg-dark-card">
          <div className="grid grid-cols-1 lg:grid-cols-2 max-h-[70vh] overflow-y-auto custom-scrollbar">
            
            {/* Left Panel: Core Specs */}
            <div className="p-10 border-r border-slate-100 dark:border-zinc-800/30">
              <SectionHeading icon={FiInfo}>Item Intel & Specs</SectionHeading>
              <div className="space-y-6">
                <div>
                  <label className="text-[10px] font-black uppercase tracking-widest text-slate-500 mb-2 block">Canonical Item Name</label>
                  <input type="text" {...register("item_name")} className={getInputClass(errors.item_name)} placeholder="Vax / Med / Supply Name" />
                  {errors.item_name && <p className="mt-2 text-[10px] font-black uppercase text-rose-500">{errors.item_name.message}</p>}
                </div>

                <div className="grid grid-cols-2 gap-6">
                  <div>
                    <label className="text-[10px] font-black uppercase tracking-widest text-slate-500 mb-2 block">System Category</label>
                    <select {...register("inventory_category_id")} className={getInputClass(errors.inventory_category_id)}>
                      <option value="" disabled>Select Sector</option>
                      {categoryOptions.map(cat => <option key={cat.id} value={cat.id}>{cat.name}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="text-[10px] font-black uppercase tracking-widest text-slate-500 mb-2 block">Unit (UoM)</label>
                    <select {...register("unit")} className={getInputClass(errors.unit)}>
                      <option value="" disabled>Select UoM</option>
                      {UNIT_OPTIONS.filter(Boolean).map(u => <option key={u} value={u}>{u}</option>)}
                    </select>
                  </div>
                </div>
              </div>

              <SectionHeading icon={FiZap}>Logistics Control</SectionHeading>
              <div className="grid grid-cols-2 gap-6">
                <div>
                   <label className="text-[10px] font-black uppercase tracking-widest text-slate-500 mb-2 block">Initial Qty</label>
                   <input type="number" {...register("stock_level")} className={getInputClass(errors.stock_level)} />
                </div>
                <div>
                   <label className="text-[10px] font-black uppercase tracking-widest text-slate-500 mb-2 block">Alert Level</label>
                   <input type="number" {...register("min_stock_level")} className={getInputClass(errors.min_stock_level)} />
                </div>
                
                <div className="col-span-2 pt-2">
                   <label className="flex items-center gap-4 cursor-pointer group">
                      <div className="relative">
                        <input type="checkbox" className="peer sr-only" {...register("track_expiration")} />
                        <div className="h-7 w-12 rounded-full bg-slate-200 transition-colors peer-checked:bg-blue-600 dark:bg-zinc-800"></div>
                        <div className="absolute left-1.5 top-1.5 h-4 w-4 rounded-full bg-white transition-all peer-checked:translate-x-5"></div>
                      </div>
                      <span className="text-xs font-black uppercase tracking-widest text-slate-600 dark:text-zinc-400 group-hover:text-blue-500 transition-colors">Track Shelf Life</span>
                   </label>
                </div>

                {watchTrackExpiration && (
                   <div className="col-span-2 animate-in slide-in-from-top-2 duration-300">
                      <label className="text-[10px] font-black uppercase tracking-widest text-slate-500 mb-2 block">Authorization Expiry</label>
                      <input type="date" {...register("expiration_date")} className={getInputClass(errors.expiration_date)} />
                   </div>
                )}
              </div>

              <div className="mt-10 rounded-3xl bg-slate-50 p-6 dark:bg-zinc-900/50 border border-slate-100 dark:border-zinc-800/40">
                <div className="flex items-center justify-between">
                   <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Provisional Status</p>
                   <span className={clsx("rounded-full border px-4 py-1.5 text-[10px] font-black uppercase tracking-widest transition-all", statusClasses)}>
                      {stockStatus}
                   </span>
                </div>
                {highThresholdWarning && (
                   <p className="mt-3 text-[10px] font-bold text-amber-600 italic">Caution: Alert threshold is high relative to current stock.</p>
                )}
              </div>
            </div>

            {/* Right Panel: Financials & Config */}
            <div className="p-10 bg-slate-50/30 dark:bg-dark-surface/5">
              <SectionHeading icon={FiBox}>Revenue Config</SectionHeading>
              <div className="space-y-6">
                <div className="grid grid-cols-2 gap-6">
                  <div>
                    <label className="text-[10px] font-black uppercase tracking-widest text-slate-500 mb-2 block">Acquisition Cost (₱)</label>
                    <input type="number" step="0.01" {...register("cost_price")} className={getInputClass(errors.cost_price)} placeholder="0.00" />
                  </div>
                  <div>
                    <label className="text-[10px] font-black uppercase tracking-widest text-slate-500 mb-2 block">Retail Markup (₱)</label>
                    <input type="number" step="0.01" {...register("selling_price")} className={getInputClass(errors.selling_price)} placeholder="0.00" />
                  </div>
                </div>

                <div>
                   <label className="text-[10px] font-black uppercase tracking-widest text-slate-500 mb-2 block">Clinical Service Rate (₱)</label>
                   <input type="number" step="0.01" {...register("service_price")} className={getInputClass(errors.service_price)} placeholder="0.00" />
                   <p className="mt-2 text-[10px] font-bold italic text-slate-400">Used if item is part of a billed clinic service.</p>
                </div>
              </div>

              <SectionHeading icon={FiActivity}>System Routing</SectionHeading>
              <div className="space-y-4">
                 <UsageToggle label="Available for Retail" sub="Item appears in point-of-sale systems" register={register("is_sellable")} active={watchSellable} />
                 <UsageToggle label="Usable in Clinic" sub="Item can be linked to veterinary services" register={register("is_service_usable")} active={watchServiceUsable} />
                 
                 <div className="pt-4 border-t border-slate-100 dark:border-zinc-800/40 space-y-4">
                    <UsageToggle label="Auth-Deduct Flow" sub="Authorize system to auto-deduct on invoice finalizing" register={register("deduct_on_finalize")} active={watchAutoDeduct} variant="blue" />
                 </div>
              </div>

              {/* Profit Preview */}
              <div className="mt-10 rounded-[2rem] bg-slate-900 p-8 text-white shadow-2xl shadow-slate-900/20">
                 <p className="text-[10px] font-black uppercase tracking-[0.3em] text-blue-400 mb-4">Financial Snapshot</p>
                 <div className="flex items-center justify-between">
                    <div>
                       <p className="text-3xl font-black">₱{(Number(watch("selling_price") || 0)).toLocaleString()}</p>
                       <p className="text-[10px] font-black uppercase text-slate-400 mt-1">Projected Sale</p>
                    </div>
                    <div className="h-10 w-px bg-slate-800"></div>
                    <div className="text-right">
                       <p className="text-3xl font-black text-emerald-400">
                          {watch("selling_price") > watch("cost_price") 
                            ? `+₱${(watch("selling_price") - watch("cost_price")).toFixed(2)}`
                            : "—"}
                       </p>
                       <p className="text-[10px] font-black uppercase text-slate-400 mt-1">Gross Margin</p>
                    </div>
                 </div>
              </div>
            </div>
          </div>

          <div className="flex items-center justify-between bg-slate-50/80 px-10 py-8 backdrop-blur-md dark:bg-dark-surface/50 border-t border-slate-100 dark:border-zinc-800/40">
            <button type="button" onClick={onClose} className="text-xs font-black uppercase tracking-widest text-slate-400 hover:text-slate-600 transition-colors">Discard Draft</button>
            <div className="flex items-center gap-4">
               <button
                  type="submit"
                  disabled={isSubmitting}
                  className="flex items-center gap-2 rounded-[1.25rem] bg-blue-600 px-10 py-4 text-xs font-black uppercase tracking-widest text-white shadow-xl shadow-blue-600/20 hover:bg-blue-700 active:scale-95 transition-all"
               >
                 {isSubmitting ? "Authorizing..." : <><FiCheckCircle className="h-4 w-4" /> Authorize Entry</>}
               </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}

function UsageToggle({ label, sub, register, active, variant = "emerald" }) {
  const activeStyles = {
    emerald: "border-emerald-200 bg-emerald-50 dark:border-emerald-900/40 dark:bg-emerald-900/20",
    blue: "border-blue-200 bg-blue-50 dark:border-blue-900/40 dark:bg-blue-900/20"
  };
  const theme = active ? activeStyles[variant] : "border-slate-100 bg-white dark:border-zinc-800/60 dark:bg-zinc-900/20";
  
  return (
    <label className={clsx("flex cursor-pointer items-start gap-4 rounded-3xl border p-5 transition-all shadow-sm", theme)}>
       <div className="mt-1">
          <input type="checkbox" {...register} className={clsx("h-5 w-5 rounded-lg border-2 border-slate-300 focus:ring-0", active && "animate-in zoom-in-50")} />
       </div>
       <div className="flex flex-col">
          <span className="text-sm font-black text-slate-800 dark:text-zinc-100 leading-tight">{label}</span>
          <span className="text-[10px] font-bold text-slate-400 mt-1">{sub}</span>
       </div>
    </label>
  );
}
