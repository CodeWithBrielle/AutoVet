import { 
  FiX, FiTrash2, FiSave, FiEdit2, FiClock, 
  FiChevronDown, FiChevronUp, FiDatabase, 
  FiDollarSign, FiShield, FiActivity,
  FiBox, FiInfo, FiTrendingUp
} from "react-icons/fi";
import { LuSparkles } from "react-icons/lu";
import clsx from "clsx";
import { useState, useEffect } from "react";
import { useToast } from "../../context/ToastContext";
import { useAuth } from "../../context/AuthContext";
import { ROLES, FULL_ACCESS_ROLES } from "../../constants/roles";
import { getInventoryStatus, getStatusStyles, INVENTORY_STATUS } from "../../utils/inventoryStatus";

// Helper Components for Cleaner Main Logic
const SectionHeader = ({ icon: Icon, title }) => (
  <div className="flex items-center gap-2 mb-6 border-b border-slate-100 pb-2 dark:border-zinc-800">
    <Icon className="h-4 w-4 text-blue-500" />
    <h4 className="text-xs font-black uppercase tracking-widest text-slate-800 dark:text-zinc-200">
      {title}
    </h4>
  </div>
);

const DetailItem = ({ label, children }) => (
  <div className="space-y-1.5">
    <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 dark:text-zinc-500">
      {label}
    </p>
    <div className="text-base font-bold text-slate-800 dark:text-zinc-100">
      {children}
    </div>
  </div>
);

const TABS = {
  GENERAL: "General",
  FINANCIAL: "Pricing & Usage",
  STOCK: "Stock & Levels",
  HISTORY: "Activity Log",
};

export default function ViewInventoryModal({ isOpen, onClose, product, onDeleteRequest, onUpdate }) {
  const toast = useToast();
  const [activeTab, setActiveTab] = useState(TABS.GENERAL);
  const [isEditing, setIsEditing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [formData, setFormData] = useState({});
  const [categoryOptions, setCategoryOptions] = useState([]);
  const [transactions, setTransactions] = useState([]);
  const [isLoadingTx, setIsLoadingTx] = useState(false);
  const [aiForecastData, setAiForecastData] = useState(null);
  const [isLoadingForecast, setIsLoadingForecast] = useState(false);

  const { user } = useAuth();
  const isPowerUser = FULL_ACCESS_ROLES.includes(user?.role);

  useEffect(() => {
    if (isOpen && product) {
      setFormData(product);
      setIsEditing(false);
      setAiForecastData(null);
      setActiveTab(TABS.GENERAL);
      
      setIsLoadingTx(true);
      fetch(`/api/inventory/${product.id}/transactions`, {
        headers: { "Accept": "application/json", "Authorization": `Bearer ${user?.token}` }
      })
        .then(res => res.json())
        .then(data => {
            setTransactions(data);
            setIsLoadingTx(false);
        })
        .catch(err => {
            console.error(err);
            setIsLoadingTx(false);
        });

      fetch("/api/inventory-categories?per_page=1000", {
        headers: { "Accept": "application/json", "Authorization": `Bearer ${user?.token}` }
      })
      .then(res => res.json())
      .then(data => {
        let categories = [];
        if (Array.isArray(data)) categories = data;
        else if (data && Array.isArray(data.data)) categories = data.data;
        setCategoryOptions(categories.filter(c => c.status === 'Active' || c.status === 'active'));
      })
      .catch(console.error);
    }
  }, [isOpen, product, user?.token]);

  const handleChange = (field, value) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const handleCheckboxChange = (field, value) => {
    setFormData(prev => {
        const newData = { ...prev, [field]: !!value };
        if (field === 'is_sellable' && !value && !newData.is_service_usable) newData.selling_price = null;
        if (field === 'is_service_usable' && !value && !newData.is_sellable) newData.selling_price = null;
        return newData;
    });
  };

  const handleSave = async () => {
    if (isSaving) return;
    setIsSaving(true);
    try {
      const res = await fetch(`/api/inventory/${formData.id}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          "Accept": "application/json",
          "Authorization": `Bearer ${user?.token}`
        },
        body: JSON.stringify(formData),
      });

      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        let errorMsg = errorData.message || "Failed to save product";
        if (errorData.errors) {
            const firstKey = Object.keys(errorData.errors)[0];
            if (errorData.errors[firstKey] && errorData.errors[firstKey][0]) errorMsg = errorData.errors[firstKey][0];
        }
        throw new Error(errorMsg);
      }

      const updated = await res.json();
      toast.success("Inventory item updated successfully!");
      setIsEditing(false);
      onUpdate(updated); 
    } catch (err) {
      toast.error(err.message || "An error occurred while saving.");
    } finally {
      setIsSaving(false);
    }
  };

  const handleRunForecast = async () => {
    if (!product?.id) {
      toast.error("Cannot run forecast without a product ID.");
      return;
    }
    setIsLoadingForecast(true);
    setAiForecastData(null);
    try {
      const response = await fetch(`/api/inventory/${product.id}/forecast`, {
        headers: { "Accept": "application/json", "Authorization": `Bearer ${user?.token}` }
      });
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.message || "Failed to fetch forecast.");
      }
      const data = await response.json();
      setAiForecastData(data);
      toast.success("AI Forecast generated successfully!");
      setActiveTab(TABS.STOCK); // Move to stock tab to see result
    } catch (err) {
      toast.error(err.message || "An error occurred during forecasting.");
      setAiForecastData({ error: err.message || "Could not generate forecast." });
    } finally {
      setIsLoadingForecast(false);
    }
  };

  if (!isOpen || !product) return null;

  const inputClass = "mt-1 w-full font-bold border-b border-slate-200 px-1 py-1 text-slate-900 focus:border-blue-500 focus:outline-none dark:border-zinc-700 dark:bg-dark-surface dark:text-zinc-50 transition-colors";

  const status = getInventoryStatus(product.stock_level, product.min_stock_level, product.expiration_date);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-sm dark:bg-zinc-950/70 overflow-y-auto">
      <div className="relative w-full max-w-2xl my-8 overflow-hidden rounded-[2.5rem] bg-white shadow-2xl dark:bg-dark-card dark:shadow-dark-soft border border-white/20">
        
        {/* Modern Header Section */}
        <div className="bg-slate-50/50 px-10 py-8 dark:bg-dark-surface/30">
          <div className="flex items-start justify-between">
            <div className="space-y-2">
              <div className="flex items-center gap-3">
                 <span className={clsx("h-2.5 w-2.5 rounded-full animate-pulse", status === INVENTORY_STATUS.IN_STOCK ? "bg-emerald-500" : "bg-rose-500")} />
                 <h3 className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 dark:text-zinc-500">Inventory Data System</h3>
              </div>
              <h2 className="text-3xl font-black text-slate-900 dark:text-zinc-50 leading-tight">
                {isEditing ? (
                  <input
                    type="text"
                    autoFocus
                    className="bg-transparent border-b-2 border-blue-500 focus:outline-none w-full"
                    value={formData.item_name || ""}
                    onChange={(e) => handleChange("item_name", e.target.value)}
                  />
                ) : product.item_name}
              </h2>
              <p className="font-bold text-blue-600 dark:text-blue-400 text-sm">{product.sku || "NO SKU GENERATED"}</p>
            </div>
            <button onClick={onClose} className="rounded-2xl p-3 text-slate-400 hover:bg-slate-200 dark:hover:bg-zinc-800 transition-colors">
              <FiX className="h-6 w-6" />
            </button>
          </div>

          {/* Tab Navigation */}
          <nav className="mt-8 flex items-center gap-2 overflow-x-auto pb-1 scrollbar-hide">
            {Object.values(TABS).map((tab) => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={clsx(
                  "whitespace-nowrap rounded-xl px-5 py-2.5 text-xs font-black uppercase tracking-widest transition-all",
                  activeTab === tab 
                    ? "bg-slate-900 text-white shadow-xl shadow-slate-900/20 dark:bg-white dark:text-black" 
                    : "text-slate-400 hover:text-slate-600 dark:text-zinc-500 dark:hover:text-zinc-300"
                )}
              >
                {tab}
              </button>
            ))}
          </nav>
        </div>

        {/* Dynamic Body Content */}
        <div className="max-h-[60vh] overflow-y-auto p-10 custom-scrollbar">
          
          {activeTab === TABS.GENERAL && (
            <div className="animate-in fade-in slide-in-from-bottom-4 duration-300 space-y-10">
              <section>
                <SectionHeader icon={FiInfo} title="Primary Spec" />
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-10">
                   <DetailItem label="Functional Category">
                     {isEditing ? (
                        <select className={inputClass} value={formData.inventory_category_id ?? ""} onChange={(e) => handleChange("inventory_category_id", parseInt(e.target.value))}>
                          {categoryOptions.map(cat => <option key={cat.id} value={cat.id}>{cat.name}</option>)}
                        </select>
                     ) : product.inventory_category?.name || "Unmapped"}
                   </DetailItem>
                   <DetailItem label="Base Unit (UoM)">
                     {isEditing ? (
                        <input className={inputClass} value={formData.unit ?? ""} onChange={(e) => handleChange("unit", e.target.value)} />
                     ) : product.unit || "N/A"}
                   </DetailItem>
                   <DetailItem label="Manufacturer SKU">
                      {isEditing ? (
                        <input className={inputClass} value={formData.sku ?? ""} onChange={(e) => handleChange("sku", e.target.value)} />
                      ) : product.sku || "Internal Only"}
                   </DetailItem>
                </div>
              </section>
            </div>
          )}

          {activeTab === TABS.FINANCIAL && (
            <div className="animate-in fade-in slide-in-from-bottom-4 duration-300 space-y-10">
              <section className="rounded-3xl bg-slate-50 p-8 dark:bg-zinc-800/20 border border-slate-100 dark:border-zinc-800">
                <SectionHeader icon={FiDollarSign} title="Revenue Settings" />
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-10">
                   <DetailItem label="Retail (Over the Counter)">
                      {isEditing ? (
                        <div className="space-y-4">
                           <input type="number" className={inputClass} value={formData.selling_price ?? ""} onChange={(e) => handleChange("selling_price", e.target.value)} />
                           <label className="flex items-center gap-2 cursor-pointer">
                              <input type="checkbox" checked={!!formData.is_sellable} onChange={(e) => handleCheckboxChange("is_sellable", e.target.checked)} />
                              <span className="text-[10px] font-bold uppercase text-slate-500">Enable Retail</span>
                           </label>
                        </div>
                      ) : (
                        <div className="space-y-1">
                          <p className="text-2xl font-black text-emerald-600 dark:text-emerald-400">₱{Number(product.selling_price || 0).toLocaleString()}</p>
                          <p className="text-[10px] text-slate-400 font-bold uppercase">{product.is_sellable ? "Available for OTC Sale" : "Internal Use Only"}</p>
                        </div>
                      )}
                   </DetailItem>
                   <DetailItem label="Service Rate (Clinical Usage)">
                      {isEditing ? (
                        <div className="space-y-4">
                           <input type="number" className={inputClass} value={formData.service_price ?? ""} onChange={(e) => handleChange("service_price", e.target.value)} />
                           <label className="flex items-center gap-2 cursor-pointer">
                              <input type="checkbox" checked={!!formData.is_service_usable} onChange={(e) => handleCheckboxChange("is_service_usable", e.target.checked)} />
                              <span className="text-[10px] font-bold uppercase text-slate-500">Enable Service Use</span>
                           </label>
                        </div>
                      ) : (
                        <div className="space-y-1">
                          <p className="text-xl font-bold text-slate-800 dark:text-zinc-100 italic">
                            {Number(product.service_price || 0) > 0 ? `₱${Number(product.service_price).toLocaleString()}` : "Same as Retail"}
                          </p>
                        </div>
                      )}
                   </DetailItem>
                </div>
                {!isEditing && (
                  <div className="mt-8 pt-6 border-t border-slate-200 dark:border-zinc-800">
                     <DetailItem label="Procurement Cost">
                        <p className="text-slate-500 font-black">₱{Number(product.cost_price || 0).toLocaleString()} <span className="text-[10px] font-bold uppercase ml-2 text-slate-400">Internal COGS</span></p>
                     </DetailItem>
                  </div>
                )}
              </section>
            </div>
          )}

          {activeTab === TABS.STOCK && (
            <div className="animate-in fade-in slide-in-from-bottom-4 duration-300 space-y-10">
              <section>
                <SectionHeader icon={FiShield} title="Thresholds & Shelf Life" />
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-10">
                   <DetailItem label="Current Inventory">
                      <p className={clsx("text-4xl font-black", status === INVENTORY_STATUS.OUT_OF_STOCK ? "text-rose-600" : "text-slate-900 dark:text-zinc-100")}>
                        {Number(product.stock_level).toLocaleString()}
                        <span className="text-sm font-bold ml-2 text-slate-400">{product.unit}</span>
                      </p>
                   </DetailItem>
                   <DetailItem label="Alert Threshold">
                      {isEditing ? (
                        <input type="number" className={inputClass} value={formData.min_stock_level ?? ""} onChange={(e) => handleChange("min_stock_level", e.target.value)} />
                      ) : (
                        <p className="text-xl font-bold">{product.min_stock_level} units</p>
                      )}
                   </DetailItem>
                   <DetailItem label="Best Before / Expiry">
                      {isEditing ? (
                        <input type="date" className={inputClass} value={formData.expiration_date ?? ""} onChange={(e) => handleChange("expiration_date", e.target.value)} />
                      ) : (
                        <p className={clsx("text-base font-bold", status === INVENTORY_STATUS.EXPIRING ? "text-rose-500" : "")}>
                          {product.expiration_date ? new Date(product.expiration_date).toLocaleDateString() : "No Expiry Recorded"}
                        </p>
                      )}
                   </DetailItem>
                </div>
              </section>

              {/* AI Insight Sub-section */}
              <section className="rounded-3xl bg-blue-600 p-8 text-white shadow-2xl shadow-blue-500/20">
                 <div className="flex items-center justify-between mb-4">
                    <h4 className="text-xs font-black uppercase tracking-widest text-blue-100">Predictive Stock Analysis</h4>
                    <LuSparkles className="h-5 w-5 text-blue-200 animate-pulse" />
                 </div>
                 {aiForecastData ? (
                   <div className="space-y-4">
                      {aiForecastData.error ? (
                        <p className="text-sm font-bold text-blue-100 italic">{aiForecastData.error}</p>
                      ) : (
                        <div className="grid grid-cols-2 gap-4">
                           <div className="p-4 bg-white/10 rounded-2xl">
                              <p className="text-[10px] font-black uppercase text-blue-200">Critical Stockout</p>
                              <p className="text-lg font-bold">{aiForecastData.predicted_stockout_date || "Stable"}</p>
                           </div>
                           <div className="p-4 bg-white/10 rounded-2xl">
                              <p className="text-[10px] font-black uppercase text-blue-200">Recommendation</p>
                              <p className="text-lg font-bold">Buy +{aiForecastData.recommended_stock || 0}</p>
                           </div>
                        </div>
                      )}
                   </div>
                 ) : (
                   <div className="flex flex-col items-center py-4 text-center">
                      <p className="text-sm font-bold text-blue-100 mb-4 px-10 leading-relaxed">Let our AI analyze historical clinic usage to predict your next stockout date.</p>
                      <button onClick={handleRunForecast} className="rounded-xl bg-white px-6 py-2 text-xs font-black uppercase tracking-widest text-blue-600 hover:bg-blue-50 transition-colors">
                         Initialize Forecast
                      </button>
                   </div>
                 )}
              </section>
            </div>
          )}

          {activeTab === TABS.HISTORY && (
            <div className="animate-in fade-in slide-in-from-bottom-4 duration-300 space-y-6">
               <SectionHeader icon={FiActivity} title="Clinical Movement Log" />
               {isLoadingTx ? (
                  <div className="py-10 text-center animate-pulse text-slate-400 font-bold uppercase tracking-widest text-xs">Accessing Ledgers...</div>
               ) : transactions.length > 0 ? (
                  <div className="space-y-4 pr-1">
                    {transactions.map(tx => (
                      <div key={tx.id} className="flex items-center justify-between rounded-[1.25rem] border border-slate-100 bg-white p-5 shadow-sm dark:border-zinc-800 dark:bg-zinc-900/40">
                         <div className="space-y-1">
                            <p className="text-sm font-black text-slate-800 dark:text-zinc-100">{tx.transaction_type}</p>
                            <p className="text-[10px] font-bold uppercase text-slate-400">{new Date(tx.created_at).toLocaleString()} • {tx.creator?.name || "System"}</p>
                            {tx.remarks && <p className="mt-2 text-xs text-slate-500 dark:text-zinc-400 italic">"{tx.remarks}"</p>}
                         </div>
                         <div className="text-right">
                           <p className={clsx("text-lg font-black", tx.quantity > 0 ? "text-emerald-500" : "text-rose-500")}>
                             {tx.quantity > 0 ? "+" : ""}{tx.quantity}
                           </p>
                           <p className="text-[10px] font-bold uppercase text-slate-400 tracking-tighter">Final: {tx.new_stock}</p>
                         </div>
                      </div>
                    ))}
                  </div>
               ) : (
                  <div className="py-20 text-center border-2 border-dashed border-slate-100 dark:border-zinc-800 rounded-3xl">
                     <FiBox className="h-10 w-10 text-slate-200 mx-auto mb-4" />
                     <p className="text-xs font-bold uppercase tracking-widest text-slate-400">No transactions recorded</p>
                  </div>
               )}
            </div>
          )}

        </div>

        {/* Global Action Bar */}
        <div className="flex items-center justify-between border-t border-slate-100 dark:border-zinc-800 bg-slate-50/50 px-10 py-6 dark:bg-dark-surface/50">
           <div className="flex gap-4">
              {isPowerUser && !isEditing && (
                <button 
                  onClick={() => onDeleteRequest(product)}
                  className="rounded-2xl p-3 text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-900/10 transition-colors"
                  title="Archive Product"
                >
                  <FiTrash2 className="h-5 w-5" />
                </button>
              )}
           </div>
           <div className="flex items-center gap-4">
              {isPowerUser && (
                <button
                  onClick={() => {
                    if (isEditing) handleSave();
                    else setIsEditing(true);
                  }}
                  disabled={isSaving}
                  className={clsx(
                    "flex items-center gap-2 rounded-2xl px-8 py-3.5 text-xs font-black uppercase tracking-widest shadow-xl transition-all active:scale-95",
                    isEditing 
                      ? "bg-emerald-600 text-white shadow-emerald-600/20 hover:bg-emerald-700" 
                      : "bg-slate-900 text-white shadow-slate-900/20 dark:bg-white dark:text-black hover:opacity-90"
                  )}
                >
                  {isEditing ? (isSaving ? "Saving..." : <><FiSave className="h-4 w-4" /> Save Intel</>) : <><FiEdit2 className="h-4 w-4" /> Modify Data</>}
                </button>
              )}
              {isEditing && (
                <button onClick={() => setIsEditing(false)} className="text-xs font-black uppercase tracking-widest text-slate-400 hover:text-slate-600 transition-colors">
                  Discard
                </button>
              )}
           </div>
        </div>
      </div>
    </div>
  );
}

