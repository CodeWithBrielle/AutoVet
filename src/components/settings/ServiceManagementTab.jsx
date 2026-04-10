import clsx from "clsx";
import { useState, useEffect } from "react";
import { FiTrash2, FiPlus, FiEdit2, FiX, FiSave } from "react-icons/fi";
import { useToast } from "../../context/ToastContext";
import { useAuth } from "../../context/AuthContext";

export const LINKED_ITEM_ELIGIBLE_CATEGORIES = [
  "Vaccination",
  "Grooming",
  "Medicine",
  "Preventive Care",
  "Consultation",
  "Surgery",
  "Diagnostic",
  "Laboratory",
  "Anesthesia",
  "Other"
];

export default function ServiceManagementTab() {
  const toast = useToast();
  const [services, setServices] = useState([]);
  const [loading, setLoading] = useState(true);
  const [serviceCategories, setServiceCategories] = useState([]);
  const [petSizes, setPetSizes] = useState([]);
  const [weightRanges, setWeightRanges] = useState([]);
  const [species, setSpecies] = useState([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingService, setEditingService] = useState(null);
  const [inventories, setInventories] = useState([]);
  const [activeTab, setActiveTab] = useState('general');
  const { user } = useAuth();

  const [formData, setFormData] = useState({
    name: "",
    description: "",
    price: 0,
    category: "",
    status: "Active",
    pricing_type: "fixed",
    measurement_basis: "none",
    professional_fee: 0,
    show_on_invoice: true,
    auto_load_linked_items: true,
    allow_manual_item_override: true,
    linked_items: [],
    pricing_rules: []
  });

  const fetchServices = () => {
    if (!user?.token) {
      setLoading(false);
      return;
    }
    setLoading(true);
    fetch("/api/services", {
      headers: {
        "Accept": "application/json",
        "Authorization": `Bearer ${user.token}`
      }
    })
      .then(res => res.json())
      .then(result => {
        const normalizedData = Array.isArray(result.data) ? result.data : (Array.isArray(result) ? result : []);
        setServices(normalizedData);
        setLoading(false);
      })
      .catch(err => { toast.error("Failed to load services"); setLoading(false); });
  };

  useEffect(() => {
    if (!user?.token) return;
    fetchServices();

    const headers = {
      "Accept": "application/json",
      "Authorization": `Bearer ${user.token}`
    };

    fetch("/api/service-categories", { headers })
      .then(res => res.json())
      .then(result => {
        const normalized = Array.isArray(result.data) ? result.data : (Array.isArray(result) ? result : []);
        setServiceCategories(normalized);
      })
      .catch(console.error);

    fetch("/api/pet-size-categories", { headers })
      .then(res => res.json())
      .then(result => {
        const normalized = Array.isArray(result.data) ? result.data : (Array.isArray(result) ? result : []);
        const sorted = [...normalized].sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0));
        setPetSizes(sorted);
      })
      .catch(console.error);

    fetch("/api/species?per_page=-1", { headers })
      .then(res => res.json())
      .then(result => {
        const normalized = Array.isArray(result.data) ? result.data : (Array.isArray(result) ? result : []);
        setSpecies(normalized);
      })
      .catch(console.error);

    fetch("/api/weight-ranges?per_page=-1", { headers })
      .then(res => res.json())
      .then(result => {
        const normalized = Array.isArray(result.data) ? result.data : (Array.isArray(result) ? result : []);
        setWeightRanges(normalized);
      })
      .catch(console.error);

    fetch("/api/inventory", { headers })
      .then(res => res.json())
      .then(result => {
        const normalized = Array.isArray(result.data) ? result.data : (Array.isArray(result) ? result : []);
        setInventories(normalized.sort((a, b) => a.item_name.localeCompare(b.item_name)));
      })
      .catch(console.error);
  }, [user?.token]);

  const handleOpenModal = (service = null) => {
    if (service) {
      setEditingService(service);
      setFormData({
        name: service.name,
        description: service.description || "",
        price: service.price,
        category: service.category || "",
        status: service.status,
        pricing_type: service.pricing_type || "fixed",
        measurement_basis: service.measurement_basis || "none",
        professional_fee: service.professional_fee ?? service.price ?? 0,
        linked_items: service.consumables || [],
        pricing_rules: service.pricing_rules || []
      });
    } else {
      setEditingService(null);
      setFormData({
        name: "",
        description: "",
        price: 0,
        category: "",
        status: "Active",
        pricing_type: "fixed",
        measurement_basis: "none",
        professional_fee: 0,
        linked_items: [],
        pricing_rules: []
      });
    }
    setActiveTab('general');
    setIsModalOpen(true);
  };

  const handleCloseModal = () => {
    setIsModalOpen(false);
    setEditingService(null);
  };

  const handleSave = async (e) => {
    e.preventDefault();
    const isEditing = !!editingService;
    const url = isEditing ? `/api/services/${editingService.id}` : "/api/services";
    const method = isEditing ? "PUT" : "POST";

    if (formData.pricing_type === 'fixed' && !formData.professional_fee) {
      toast.error("Fixed Price service requires a Professional Fee.");
      return;
    }

    if (formData.pricing_type === 'weight_based' && formData.pricing_rules.length === 0) {
      toast.error("Weight Based requires at least one pricing rule.");
      return;
    }

    for (const li of formData.linked_items) {
      const inv = inventories.find(i => i.id === Number(li.inventory_id));
      if (!inv) continue;
      if (!(Number(inv.cost_price) > 0)) {
        toast.error(`'${inv.item_name}' must have a valid cost price.`);
        return;
      }
    }

    let cleanedRules = [];
    if (formData.pricing_type === 'weight_based') {
      cleanedRules = formData.pricing_rules
        .filter(r => r.basis_type === 'weight' && r.price !== "" && r.price !== null && r.price !== undefined)
        .map(r => ({ ...r, price: Number(r.price) }));
    }

    const payload = {
      ...formData,
      measurement_basis: formData.pricing_type === 'weight_based' ? 'weight' : 'none',
      price: Number(formData.professional_fee || formData.price || 0),
      professional_fee: Number(formData.professional_fee || 0),
      pricing_rules: cleanedRules
    };

    try {
      const res = await fetch(url, {
        method,
        headers: {
          "Content-Type": "application/json",
          "Accept": "application/json",
          "Authorization": `Bearer ${user?.token}`
        },
        body: JSON.stringify(payload)
      });
      
      const result = await res.json();
      if (!res.ok) {
        const errorMsg = result.errors
          ? Object.values(result.errors).flat().join(", ")
          : (result.message || "Failed to save service");
        throw new Error(errorMsg);
      }
      toast.success(isEditing ? "Service updated" : "Service created");
      fetchServices();
      handleCloseModal();
    } catch (err) {
      toast.error(err.message);
    }
  };

  const handleDelete = async (id) => {
    if (!confirm("Archive: recoverable within 30 days.\nAre you sure you want to archive this service?")) return;
    try {
      const res = await fetch(`/api/services/${id}`, {
        method: "DELETE",
        headers: {
          "Accept": "application/json",
          "Authorization": `Bearer ${user?.token}`
        }
      });
      if (!res.ok) throw new Error("Failed to archive");
      toast.success("Service archived");
      fetchServices();
    } catch (err) {
      toast.error(err.message);
    }
  };

  if (loading) return <div className="p-6 text-slate-500">Loading services...</div>;

  return (
    <section className="card-shell p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h3 className="text-2xl font-bold text-slate-900 dark:text-zinc-50">Service Management</h3>
          <p className="mt-1 text-sm text-slate-500 dark:text-zinc-400">Manage invoice services and fixed prices.</p>
        </div>
        <button onClick={() => handleOpenModal()} className="inline-flex items-center gap-2 rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-blue-700transition-all">
          <FiPlus className="h-4 w-4" />
          Add New Service
        </button>
      </div>

      <div className="mt-5 overflow-x-auto">
        <table className="w-full min-w-[680px]">
          <thead className="border-b border-slate-200 bg-slate-50 text-left text-xs font-semibold uppercase tracking-wider text-slate-500 dark:border-dark-border dark:bg-dark-surface dark:text-zinc-400">
            <tr>
              <th className="px-4 py-3">Service Name</th>
              <th className="px-4 py-3">Category</th>
              <th className="px-4 py-3">Pricing Mode</th>
              <th className="px-4 py-3">Professional Fee / Pricing Rule</th>
              <th className="px-4 py-3 text-center">Status</th>
              <th className="px-4 py-3">Action</th>
            </tr>
          </thead>
          <tbody>
            {services.map((svc) => (
              <tr key={svc.id} className="border-b border-slate-200/80 dark:border-dark-border group hover:bg-slate-50/50 dark:hover:bg-dark-surface/50 transition-colors">
                <td className="px-4 py-4">
                  <p className="text-sm font-bold text-slate-800 dark:text-zinc-50">{svc.name}</p>
                  <p className="max-w-[180px] truncate text-xs text-slate-500 dark:text-zinc-400">{svc.description}</p>
                </td>
                <td className="px-4 py-4 text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-zinc-400">
                  {svc.category || "Uncategorized"}
                </td>
                <td className="px-4 py-4">
                  <span className={clsx(
                    "rounded-lg px-2 py-1 text-[10px] font-bold uppercase tracking-tight shadow-sm",
                    svc.pricing_type === 'weight_based' ? "bg-violet-100 text-violet-700 dark:bg-violet-900/30 dark:text-violet-400" :
                    "bg-slate-100 text-slate-700 dark:bg-dark-surface dark:text-zinc-400"
                  )}>
                    {svc.pricing_type?.replace('_', ' ') || 'Fixed'}
                  </span>
                </td>
                <td className="px-4 py-4">
                  {svc.pricing_type === 'fixed' || !svc.pricing_type ? (
                    <p className="text-sm font-bold text-slate-900 dark:text-zinc-50">
                      ₱{Number(svc.base_price || svc.price || 0).toLocaleString("en-PH", { minimumFractionDigits: 2 })}
                      <span className="ml-1.5 text-[10px] font-normal text-slate-400 dark:text-zinc-500">Professional Fee</span>
                    </p>
                  ) : (
                    <div>
                      {svc.pricing_rules && svc.pricing_rules.length > 0 ? (
                        <p className="flex items-center gap-1.5 text-sm font-bold text-blue-600 dark:text-blue-400">
                          <span className="h-1.5 w-1.5 rounded-full bg-blue-500 animate-pulse" />
                          {svc.pricing_rules.length} Weight Brackets
                          <span className="text-[10px] font-normal text-slate-400 dark:text-zinc-500">Configured</span>
                        </p>
                      ) : (
                        <div className="flex items-center gap-1.5 text-sm font-bold text-rose-500">
                          <span className="h-1.5 w-1.5 rounded-full bg-rose-500" />
                          No Pricing Rules Set
                        </div>
                      )}
                    </div>
                  )}
                </td>
                <td className="px-4 py-4 text-center">
                  <span
                    className={clsx(
                      "inline-flex rounded-full border px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider",
                      svc.status === "Active"
                        ? "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-400"
                        : "border-slate-200 bg-slate-100 text-slate-600 dark:border-dark-border dark:bg-dark-surface dark:text-zinc-400"
                    )}
                  >
                    {svc.status}
                  </span>
                </td>
                <td className="px-4 py-4">
                  <div className="flex items-center gap-2">
                    <button onClick={() => handleOpenModal(svc)} className="flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-500 hover:bg-slate-100 transition-colors dark:bg-dark-card dark:border-dark-border dark:text-zinc-400 dark:hover:bg-dark-surface">
                      <FiEdit2 size={14} />
                    </button>
                    <button onClick={() => handleDelete(svc.id)} className="flex h-8 w-8 items-center justify-center rounded-lg border border-rose-200 bg-white text-rose-500 hover:bg-rose-50 transition-colors dark:bg-dark-card dark:border-rose-900/40 dark:text-rose-400 dark:hover:bg-rose-900/30">
                      <FiTrash2 size={14} />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
            {services.length === 0 && (
              <tr>
                <td colSpan="6" className="px-4 py-8 text-center text-sm text-slate-500">No services found. Add one to get started.</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 backdrop-blur-sm p-4 overflow-y-auto">
          <div className="w-full max-w-4xl rounded-3xl bg-white shadow-2xl dark:bg-dark-card border border-slate-200 dark:border-dark-border overflow-hidden">
            <div className="flex items-center justify-between p-6 border-b border-slate-100 dark:border-dark-border bg-slate-50/50 dark:bg-dark-surface/30">
              <div>
                <h3 className="text-xl font-bold text-slate-900 dark:text-zinc-50">{editingService ? "Update Service Details" : "Configure New Service"}</h3>
                <p className="text-xs text-slate-500 mt-0.5">Define service name, type, and species-specific pricing rules.</p>
              </div>
              <button
                onClick={handleCloseModal}
                className="flex h-10 w-10 items-center justify-center rounded-xl bg-white dark:bg-dark-surface text-slate-400 hover:text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-900/20 transition-all border border-slate-200 dark:border-dark-border shadow-sm"
              >
                <FiX size={20} />
              </button>
            </div>

            <form onSubmit={handleSave} className="p-0 flex flex-col h-full max-h-[85vh]">
              <div className="flex border-b border-slate-100 dark:border-dark-border px-6 pt-2 overflow-x-auto custom-scrollbar">
                {['general', 'pricing', 'required_items', 'billing_rules'].map(tab => (
                  <button
                    key={tab}
                    type="button"
                    onClick={() => setActiveTab(tab)}
                    className={clsx(
                      "px-4 py-3 text-sm font-bold border-b-2 whitespace-nowrap transition-colors",
                      activeTab === tab
                        ? "border-blue-600 text-blue-600 dark:text-blue-400 dark:border-blue-500"
                        : "border-transparent text-slate-500 hover:text-slate-700 dark:text-zinc-400 dark:hover:text-zinc-300"
                    )}
                  >
                    {tab.split('_').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ')}
                  </button>
                ))}
              </div>

              <div className="p-6 overflow-y-auto flex-1 custom-scrollbar min-h-[400px]">
                {/* General Tab */}
                {activeTab === 'general' && (
                  <div className="max-w-2xl mx-auto space-y-6">
                    <div className="p-8 space-y-6">
                      <div className="space-y-4">
                        <h4 className="text-xs font-bold uppercase tracking-widest text-slate-400 dark:text-zinc-500">General Information</h4>
                        <div>
                          <label className="block text-sm font-bold text-slate-700 dark:text-zinc-300 mb-2">Service Name *</label>
                          <input
                            required
                            type="text"
                            placeholder="e.g. Full Grooming (Large)"
                            value={formData.name}
                            onChange={e => setFormData({ ...formData, name: e.target.value })}
                            className="w-full rounded-2xl border border-slate-200 p-3 text-sm focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500 focus:outline-none dark:bg-dark-surface dark:border-dark-border dark:text-white transition-all"
                          />
                        </div>
                        <div>
                          <label className="block text-sm font-bold text-slate-700 dark:text-zinc-300 mb-2">Service Category</label>
                          <select
                            required
                            value={formData.category}
                            onChange={e => setFormData({ ...formData, category: e.target.value })}
                            className="w-full rounded-2xl border border-slate-200 p-3 text-sm focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500 focus:outline-none dark:bg-dark-surface dark:border-dark-border dark:text-white appearance-none"
                          >
                            <option value="">Select Category</option>
                            {serviceCategories.map(c => (
                              <option key={c.id || c} value={c.name || c}>{c.name || c}</option>
                            ))}
                          </select>
                        </div>
                        <div>
                          <label className="block text-sm font-bold text-slate-700 dark:text-zinc-300 mb-2">Description</label>
                          <textarea
                            rows="3"
                            placeholder="Detailed service explanation..."
                            value={formData.description}
                            onChange={e => setFormData({ ...formData, description: e.target.value })}
                            className="w-full rounded-2xl border border-slate-200 p-3 text-sm focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500 focus:outline-none dark:bg-dark-surface dark:border-dark-border dark:text-white transition-all resize-none"
                          />
                        </div>
                        <div className="pt-2">
                          <label className="block text-sm font-bold text-slate-700 dark:text-zinc-300 mb-2">Service Status</label>
                          <div className="flex gap-4">
                            {['Active', 'Inactive'].map(s => (
                              <button
                                key={s}
                                type="button"
                                onClick={() => setFormData({ ...formData, status: s })}
                                className={clsx(
                                  "flex-1 py-2.5 rounded-xl border text-sm font-bold transition-all",
                                  formData.status === s
                                    ? "bg-blue-50 border-blue-200 text-blue-600 dark:bg-blue-900/20 dark:border-blue-800 dark:text-blue-400"
                                    : "bg-white border-slate-200 text-slate-500 dark:bg-dark-surface dark:border-dark-border"
                                )}
                              >
                                {s}
                              </button>
                            ))}
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {/* Pricing Tab */}
                {activeTab === 'pricing' && (
                  <div className="max-w-3xl mx-auto space-y-6">
                    <div className="space-y-4">
                      <h4 className="text-xs font-bold uppercase tracking-widest text-slate-400 dark:text-zinc-500">Pricing Model</h4>
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <label className="block text-sm font-bold text-slate-700 dark:text-zinc-300 mb-2">Mode</label>
                          <select
                            value={formData.pricing_type}
                            onChange={e => {
                              const type = e.target.value;
                              let basis = 'none';
                              if (type === 'weight_based') basis = 'weight';
                              setFormData({ ...formData, pricing_type: type, measurement_basis: basis });
                            }}
                            className="w-full rounded-2xl border border-slate-200 p-3 text-sm focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500 focus:outline-none dark:bg-dark-surface dark:border-dark-border dark:text-white"
                          >
                            <option value="fixed">Fixed Price</option>
                            <option value="weight_based">Weight Based</option>
                          </select>
                        </div>
                        {formData.pricing_type === 'fixed' && (
                          <div>
                            <label className="block text-sm font-bold text-slate-700 dark:text-zinc-300 mb-2">Professional Fee (₱)</label>
                            <div className="relative">
                              <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 text-sm font-bold">₱</span>
                              <input
                                required
                                min="0"
                                step="0.01"
                                type="number"
                                value={formData.professional_fee || formData.price}
                                onChange={e => setFormData({ ...formData, professional_fee: e.target.value, price: e.target.value })}
                                className="w-full rounded-2xl border border-slate-200 p-3 pl-8 text-sm font-bold focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500 focus:outline-none dark:bg-dark-surface dark:border-dark-border dark:text-white"
                              />
                            </div>
                          </div>
                        )}
                      </div>

                      {formData.pricing_type === 'weight_based' && (
                        <div className="space-y-6 pt-2">
                          <div className="flex items-center justify-between">
                            <h5 className="text-sm font-bold text-slate-800 dark:text-zinc-200">Species-Specific Brackets</h5>
                            <span className="bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400 px-2 py-0.5 rounded-md text-[10px] font-bold uppercase tracking-wider">Automated Mapping</span>
                          </div>
                          <div className="space-y-8 max-h-[400px] overflow-y-auto pr-2 custom-scrollbar">
                            {species.filter(s => weightRanges.some(r => Number(r.species_id) === Number(s.id))).map(sp => (
                              <div key={sp.id} className="space-y-4">
                                <div className="flex items-center gap-3 border-l-4 border-blue-500 pl-3">
                                  <h6 className="text-sm font-bold text-slate-900 dark:text-zinc-100">{sp.name}</h6>
                                  <div className="h-px flex-1 bg-slate-200 dark:bg-dark-border" />
                                </div>
                                <div className="grid gap-3">
                                  {weightRanges.filter(r => r.species_id === sp.id).map(range => {
                                    const rule = formData.pricing_rules.find(r => r.basis_type === 'weight' && r.reference_id === range.id);
                                    return (
                                      <div key={range.id} className="group flex items-center justify-between gap-4 p-3 rounded-2xl bg-white dark:bg-dark-card border border-slate-100 dark:border-dark-border hover:shadow-md transition-all">
                                        <div className="flex-1 min-w-0">
                                          <p className="text-xs font-bold text-slate-800 dark:text-zinc-100 truncate">{range.label}</p>
                                          <p className="text-[10px] text-slate-500 font-medium">{range.min_weight}-{range.max_weight || '∞'} {range.unit}</p>
                                        </div>
                                        <div className="relative w-32">
                                          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-xs font-bold">₱</span>
                                          <input
                                            type="number"
                                            required
                                            placeholder="0.00"
                                            value={rule?.price || ""}
                                            onChange={e => {
                                              const newPrice = e.target.value;
                                              const otherRules = formData.pricing_rules.filter(r => !(r.basis_type === 'weight' && r.reference_id === range.id));
                                              setFormData({
                                                ...formData,
                                                pricing_rules: [...otherRules, { basis_type: 'weight', reference_id: range.id, price: newPrice }]
                                              });
                                            }}
                                            className="w-full rounded-xl border border-slate-100 dark:bg-dark-surface dark:border-dark-border py-2.5 pl-7 pr-3 text-sm font-bold text-slate-900 dark:text-zinc-50 focus:border-blue-500 focus:outline-none transition-all"
                                          />
                                        </div>
                                      </div>
                                    );
                                  })}
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* Required Items Tab */}
                {activeTab === 'required_items' && (
                  <div className="max-w-4xl mx-auto space-y-6">
                    <div className="flex items-center justify-between">
                      <div>
                        <h4 className="text-xs font-bold uppercase tracking-widest text-slate-400 dark:text-zinc-500">Service Consumables</h4>
                        <p className="text-sm text-slate-500">Add inventory items required for this service.</p>
                      </div>
                      <button
                        type="button"
                        onClick={() => {
                          setFormData({
                            ...formData,
                            linked_items: [...formData.linked_items, { inventory_id: "", quantity: 1, billing_behavior: "separately_billable", is_required: true, auto_deduct: true, notes: "" }]
                          });
                        }}
                        className="inline-flex items-center gap-2 rounded-xl bg-slate-100 px-3 py-2 text-xs font-bold text-slate-700 hover:bg-slate-200 dark:bg-dark-surface dark:text-zinc-300 dark:hover:bg-dark-border"
                      >
                        <FiPlus /> Add Item
                      </button>
                    </div>
                    <div className="space-y-4">
                      {formData.linked_items.map((item, idx) => (
                        <div key={idx} className="flex flex-wrap items-end gap-3 p-4 rounded-2xl bg-slate-50 dark:bg-dark-surface border border-slate-100 dark:border-dark-border">
                          <div className="flex-1 min-w-[200px]">
                            <label className="block text-xs font-bold text-slate-700 dark:text-zinc-400 mb-1">Inventory Item *</label>
                            <select
                              required
                              value={item.inventory_id}
                              onChange={e => {
                                const nw = [...formData.linked_items];
                                nw[idx].inventory_id = e.target.value;
                                setFormData({ ...formData, linked_items: nw });
                              }}
                              className="w-full rounded-xl border border-slate-200 p-2.5 text-sm focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 dark:bg-dark-card dark:border-dark-border dark:text-white"
                            >
                              <option value="">Select Active Item</option>
                              {inventories.filter(inv => inv && String(inv.status).toLowerCase() !== 'inactive' && Boolean(inv.is_service_usable)).map(inv => (
                                <option key={inv.id} value={inv.id}>{inv.item_name}</option>
                              ))}
                            </select>
                          </div>
                          <div className="w-24">
                            <label className="block text-xs font-bold text-slate-700 dark:text-zinc-400 mb-1">Qty *</label>
                            <input
                              required type="number" step="0.01" min="0.01"
                              value={item.quantity}
                              onChange={e => {
                                const nw = [...formData.linked_items];
                                nw[idx].quantity = e.target.value;
                                setFormData({ ...formData, linked_items: nw });
                              }}
                              className="w-full rounded-xl border border-slate-200 p-2.5 text-sm focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 dark:bg-dark-card dark:border-dark-border dark:text-white"
                            />
                          </div>
                          <button
                            type="button"
                            onClick={() => {
                              const nw = [...formData.linked_items];
                              nw.splice(idx, 1);
                              setFormData({ ...formData, linked_items: nw });
                            }}
                            className="p-2.5 text-rose-500 hover:bg-rose-50 rounded-xl transition-colors dark:hover:bg-rose-900/20"
                          >
                            <FiTrash2 />
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Billing Rules Tab */}
                {activeTab === 'billing_rules' && (
                  <div className="max-w-3xl mx-auto space-y-6">
                    <h4 className="text-xs font-bold uppercase tracking-widest text-slate-400 dark:text-zinc-500">Linked Items Billing & deduction</h4>
                    <p className="text-sm text-slate-500 mb-4">Configure how connected items behave when this service is applied.</p>
                    <div className="space-y-4">
                      {formData.linked_items.map((item, idx) => {
                        const inv = inventories.find(i => i.id === Number(item.inventory_id));
                        return (
                          <div key={idx} className="p-4 rounded-xl border border-slate-100 dark:border-dark-border grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div>
                              <p className="font-bold text-sm text-slate-800 dark:text-zinc-200">{inv ? inv.item_name : "Unselected Item"}</p>
                              <label className="block text-xs font-bold text-slate-700 dark:text-zinc-400 mb-1 mt-2">Billing Behavior</label>
                              <select
                                value={item.billing_behavior || 'separately_billable'}
                                onChange={e => {
                                  const nw = [...formData.linked_items];
                                  nw[idx].billing_behavior = e.target.value;
                                  setFormData({ ...formData, linked_items: nw });
                                }}
                                className="w-full rounded-xl border border-slate-200 p-2.5 text-sm focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 dark:bg-dark-card dark:border-dark-border dark:text-white"
                              >
                                <option value="included">Included</option>
                                <option value="separately_billable">Billable</option>
                                <option value="internal_only">Internal</option>
                              </select>
                            </div>
                            <div className="space-y-2">
                              <label className="flex items-center gap-2">
                                <input
                                  type="checkbox"
                                  checked={item.is_required}
                                  onChange={e => {
                                    const nw = [...formData.linked_items];
                                    nw[idx].is_required = e.target.checked;
                                    setFormData({ ...formData, linked_items: nw });
                                  }}
                                  className="w-4 h-4 text-blue-600 rounded focus:ring-blue-500 dark:ring-offset-dark-surface dark:bg-dark-card dark:border-dark-border"
                                />
                                <span className="text-sm text-slate-700 dark:text-zinc-300">Required (Mandatory part of service)</span>
                              </label>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>

              <div className="flex items-center justify-between p-6 border-t border-slate-100 dark:border-dark-border bg-white dark:bg-dark-card">
                <p className="text-xs text-slate-400 italic">Ensure required fields are completed.</p>
                <div className="flex gap-3">
                  <button type="button" onClick={handleCloseModal} className="px-6 py-2.5 rounded-xl font-bold text-slate-600 hover:text-slate-900 border border-slate-200">
                    Cancel
                  </button>
                  <button type="submit" className="flex items-center gap-2 rounded-xl bg-blue-600 px-8 py-2.5 font-bold text-white shadow-lg shadow-blue-600/20 transition-all">
                    <FiSave /> Save Service
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}
    </section>
  );
}
