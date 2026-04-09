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
  const [inventories, setInventories] = useState([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingService, setEditingService] = useState(null);
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

    // Fetch categories from MDM
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
        // Sort by sort_order if available, otherwise keep alphabetical or natural
        const sorted = [...normalized].sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0));
        setPetSizes(sorted);
      })
      .catch(console.error);

    fetch("/api/weight-ranges", { headers })
      .then(res => res.json())
      .then(result => {
        const normalized = Array.isArray(result.data) ? result.data : (Array.isArray(result) ? result : []);
        setWeightRanges(normalized);
      })
      .catch(console.error);

    fetch("/api/inventories", { headers })
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
        professional_fee: service.professional_fee || service.price || 0,
        show_on_invoice: service.show_on_invoice ?? true,
        auto_load_linked_items: service.auto_load_linked_items ?? true,
        allow_manual_item_override: service.allow_manual_item_override ?? true,
        linked_items: service.consumables ? service.consumables.map(c => ({
          inventory_id: c.inventory_id,
          quantity: c.quantity,
          is_billable: c.is_billable ?? true,
          is_required: c.is_required ?? false,
          auto_deduct: c.auto_deduct ?? true,
          notes: c.notes || ""
        })) : [],
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
        show_on_invoice: true,
        auto_load_linked_items: true,
        allow_manual_item_override: true,
        linked_items: [],
        pricing_rules: []
      });
    }
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

    // Validation
    if (formData.pricing_type === 'fixed' && !formData.professional_fee) {
      toast.error("Fixed Price service requires a Professional Fee.");
      return;
    }

    if ((formData.pricing_type === 'size_based' || formData.pricing_type === 'weight_based') && formData.pricing_rules.length === 0) {
      toast.error(`${formData.pricing_type.replace('_', ' ')} requires at least one pricing rule.`);
      return;
    }

    // Clean up pricing rules based on pricing_type
    let cleanedRules = [];
    if (formData.pricing_type === 'size_based' || formData.pricing_type === 'weight_based') {
      cleanedRules = formData.pricing_rules.filter(r => r.basis_type === 'size');
    } else if (formData.pricing_type === 'rule_based') {
      cleanedRules = formData.pricing_rules.filter(r => r.basis_type === 'rule');
    }

    const payload = { 
      ...formData, 
      price: Number(formData.professional_fee || formData.price),
      professional_fee: Number(formData.professional_fee),
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
      if (!res.ok) throw new Error("Failed to save service");
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
        <button onClick={() => handleOpenModal()} className="inline-flex items-center gap-2 rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-blue-700">
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
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3">Action</th>
            </tr>
          </thead>
          <tbody>
            {services.map((svc) => (
              <tr key={svc.id} className="border-b border-slate-200/80 dark:border-dark-border">
                <td className="px-4 py-4">
                  <p className="text-sm font-medium text-slate-900 dark:text-zinc-50">{svc.name}</p>
                  <p className="text-xs text-slate-500 dark:text-zinc-400 truncate max-w-[200px]">{svc.description}</p>
                </td>
                <td className="px-4 py-4 text-sm text-slate-700 dark:text-zinc-300">{svc.category || "-"}</td>
                <td className="px-4 py-4">
                  <span className="capitalize text-xs font-medium text-slate-600 dark:text-zinc-400 bg-slate-100 dark:bg-dark-surface px-2 py-1 rounded">
                    {svc.pricing_type?.replace('_', ' ') || 'Fixed'}
                  </span>
                </td>
                <td className="px-4 py-4 text-sm font-semibold text-slate-900 dark:text-zinc-50">
                  {svc.pricing_type === 'fixed' ? (
                    `₱${Number(svc.professional_fee || svc.price || 0).toFixed(2)} Professional Fee`
                  ) : svc.pricing_rules?.length > 0 ? (
                    <span className="text-blue-600 dark:text-blue-400 text-xs font-bold bg-blue-50 dark:bg-blue-900/20 px-2 py-1 rounded">
                      {svc.pricing_rules.length} {
                        svc.pricing_type === 'size_based' ? 'Size Rates' : 
                        svc.pricing_type === 'weight_based' ? 'Weight Brackets' : 
                        'Custom Rules'
                      } Configured
                    </span>
                  ) : (
                    <span className="text-rose-500 text-xs font-bold italic">No Pricing Rules Set</span>
                  )}
                </td>
                <td className="px-4 py-4">
                  <span
                    className={clsx(
                      "inline-flex rounded-full border px-2.5 py-1 text-xs font-semibold",
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
                    <button onClick={() => handleOpenModal(svc)} className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-600 dark:border-dark-border dark:text-zinc-400 dark:hover:bg-dark-surface hover:bg-slate-100">
                      Edit
                    </button>
                    <button onClick={() => handleDelete(svc.id)} className="inline-flex items-center gap-1 rounded-lg border border-rose-200 px-3 py-1.5 text-xs font-semibold text-rose-600 dark:border-rose-900/40 dark:text-rose-400 dark:hover:bg-rose-900/30 hover:bg-rose-50">
                      <FiTrash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
            {services.length === 0 && (
              <tr>
                <td colSpan="5" className="px-4 py-8 text-center text-sm text-slate-500">No services found. Add one to get started.</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 p-4">
          <div className="w-full max-w-2xl rounded-2xl bg-white flex flex-col max-h-[90vh] shadow-xl dark:bg-dark-card border dark:border-dark-border">
            <div className="flex items-center justify-between p-6 border-b border-slate-200 dark:border-dark-border shrink-0">
              <h3 className="text-xl font-bold text-slate-900 dark:text-zinc-50">{editingService ? "Edit Service Setup" : "Add New Service"}</h3>
              <button onClick={handleCloseModal} className="text-slate-400 hover:text-slate-600 dark:hover:text-zinc-300"><FiX size={20}/></button>
            </div>
            
            <form onSubmit={handleSave} className="flex-1 overflow-y-auto p-6 space-y-8 custom-scrollbar">
              {/* SECTION A: Basic Details */}
              <section>
                <h4 className="text-md font-bold text-slate-900 dark:text-zinc-50 mb-4 border-b pb-2 dark:border-dark-border">A. Service Details</h4>
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-semibold text-slate-700 dark:text-zinc-300 mb-1">Service Name *</label>
                    <input required type="text" value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} className="w-full rounded-xl border border-slate-200 p-2.5 text-sm focus:border-blue-500 focus:outline-none dark:bg-dark-surface dark:border-dark-border dark:text-white" />
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-slate-700 dark:text-zinc-300 mb-1">Description</label>
                    <textarea rows="2" value={formData.description} onChange={e => setFormData({...formData, description: e.target.value})} className="w-full rounded-xl border border-slate-200 p-2.5 text-sm focus:border-blue-500 focus:outline-none dark:bg-dark-surface dark:border-dark-border dark:text-white" />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-semibold text-slate-700 dark:text-zinc-300 mb-1">Category</label>
                      <select value={formData.category} onChange={e => {
                        const newCat = e.target.value;
                        let newItems = formData.linked_items;
                        if (!LINKED_ITEM_ELIGIBLE_CATEGORIES.includes(newCat) && newItems.length > 0) {
                          if (window.confirm("Changing to this category will remove all currently linked items since it does not support them. Proceed?")) {
                            newItems = [];
                          } else {
                            return; // prevent category change
                          }
                        }
                        setFormData({...formData, category: newCat, linked_items: newItems});
                      }} className="w-full rounded-xl border border-slate-200 p-2.5 text-sm focus:border-blue-500 focus:outline-none dark:bg-dark-surface dark:border-dark-border dark:text-white">
                        <option value="">Select Category</option>
                        {serviceCategories.map(c => (
                          <option key={c.id || c} value={c.name || c}>{c.name || c}</option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="block text-sm font-semibold text-slate-700 dark:text-zinc-300 mb-1">Status</label>
                      <select value={formData.status} onChange={e => setFormData({...formData, status: e.target.value})} className="w-full rounded-xl border border-slate-200 p-2.5 text-sm focus:border-blue-500 focus:outline-none dark:bg-dark-surface dark:border-dark-border dark:text-white">
                        <option value="Active">Active</option>
                        <option value="Inactive">Inactive</option>
                      </select>
                    </div>
                  </div>
                </div>
              </section>

              {/* SECTION B: Pricing & Billing */}
              <section>
                <h4 className="text-md font-bold text-slate-900 dark:text-zinc-50 mb-4 border-b pb-2 dark:border-dark-border">B. Billing Configuration</h4>
                <div className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-semibold text-slate-700 dark:text-zinc-300 mb-1">Pricing Mode</label>
                      <select 
                        value={formData.pricing_type} 
                        onChange={e => {
                          const type = e.target.value;
                          let basis = 'none';
                          if (type === 'size_based') basis = 'size';
                          if (type === 'weight_based') basis = 'weight';
                          setFormData({...formData, pricing_type: type, measurement_basis: basis});
                        }}
                        className="w-full rounded-xl border border-slate-200 p-2.5 text-sm focus:border-blue-500 focus:outline-none dark:bg-dark-surface dark:border-dark-border dark:text-white"
                      >
                        <option value="fixed">Fixed Price</option>
                        <option value="size_based">Size Based</option>
                        <option value="weight_based">Weight Based</option>
                        <option value="rule_based">Rule-Based (Advanced)</option>
                      </select>
                    </div>
                    {formData.pricing_type === 'fixed' && (
                      <div>
                        <label className="block text-sm font-semibold text-slate-700 dark:text-zinc-300 mb-1">Professional Fee (₱) *</label>
                        <input required min="0" step="0.01" type="number" value={formData.professional_fee || formData.price} onChange={e => setFormData({...formData, professional_fee: e.target.value, price: e.target.value})} className="w-full rounded-xl border border-slate-200 p-2.5 text-sm focus:border-blue-500 focus:outline-none dark:bg-dark-surface dark:border-dark-border dark:text-white" />
                      </div>
                    )}
                  </div>

                  {formData.pricing_type === 'rule_based' && (
                    <div className="dark:border-dark-border bg-blue-50/50 dark:bg-blue-900/10 p-4 rounded-xl border border-blue-200">
                      <div className="flex items-center justify-between mb-3 border-b border-blue-100 dark:border-blue-900/50 pb-2">
                        <p className="text-sm font-bold text-blue-800 dark:text-blue-400">Rule-Based Configuration</p>
                        <button 
                          type="button" 
                          onClick={() => setFormData({...formData, pricing_rules: [...formData.pricing_rules, { basis_type: 'rule', price: 0, species_id: null, breed_id: null, min_weight: null, max_weight: null, size_category_id: null }]})}
                          className="text-xs font-bold text-blue-600 dark:text-blue-400 hover:underline flex items-center gap-1"
                        >
                          <FiPlus /> Add Rule
                        </button>
                      </div>
                      
                      <div className="space-y-4 max-h-64 overflow-y-auto pr-2 custom-scrollbar">
                        {formData.pricing_rules.filter(r => r.basis_type === 'rule').map((rule, ridx) => (
                          <div key={ridx} className="bg-white dark:bg-dark-card border dark:border-dark-border rounded-lg p-3 relative group">
                            <button 
                              type="button" 
                              onClick={() => {
                                const newRules = [...formData.pricing_rules];
                                newRules.splice(formData.pricing_rules.indexOf(rule), 1);
                                setFormData({...formData, pricing_rules: newRules});
                              }}
                              className="absolute -top-2 -right-2 bg-rose-500 text-white rounded-full p-1 opacity-0 group-hover:opacity-100 transition-opacity shadow-sm"
                            >
                              <FiX size={12} />
                            </button>
                            
                            <div className="grid grid-cols-2 gap-3 mb-3">
                              <div>
                                <label className="block text-[10px] font-bold text-slate-400 uppercase">Match Species</label>
                                <select 
                                  value={rule.species_id || ""} 
                                  onChange={e => {
                                    const rules = [...formData.pricing_rules];
                                    rules[formData.pricing_rules.indexOf(rule)].species_id = e.target.value || null;
                                    setFormData({...formData, pricing_rules: rules});
                                  }}
                                  className="w-full text-xs rounded border border-slate-200 p-1 dark:bg-dark-surface dark:border-dark-border dark:text-white"
                                >
                                  <option value="">Any Species</option>
                                  {(window.MDM_SPECIES || []).map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                                </select>
                              </div>
                              <div>
                                <label className="block text-[10px] font-bold text-slate-400 uppercase">Match Size</label>
                                <select 
                                  value={rule.size_category_id || ""} 
                                  onChange={e => {
                                    const rules = [...formData.pricing_rules];
                                    rules[formData.pricing_rules.indexOf(rule)].size_category_id = e.target.value || null;
                                    setFormData({...formData, pricing_rules: rules});
                                  }}
                                  className="w-full text-xs rounded border border-slate-200 p-1 dark:bg-dark-surface dark:border-dark-border dark:text-white"
                                >
                                  <option value="">Any Size</option>
                                  {petSizes.map(sz => <option key={sz.id} value={sz.id}>{sz.name}</option>)}
                                </select>
                              </div>
                            </div>
                            
                            <div className="flex items-center gap-2">
                              <div className="flex-1">
                                <label className="block text-[10px] font-bold text-slate-400 uppercase">Weight Range (kg)</label>
                                <div className="flex items-center gap-2">
                                  <input type="number" placeholder="Min" value={rule.min_weight || ""} onChange={e => {
                                    const rules = [...formData.pricing_rules];
                                    rules[formData.pricing_rules.indexOf(rule)].min_weight = e.target.value || null;
                                    setFormData({...formData, pricing_rules: rules});
                                  }} className="w-full text-xs rounded border border-slate-200 p-1 dark:bg-dark-surface dark:border-dark-border dark:text-white" />
                                  <span className="text-slate-400">to</span>
                                  <input type="number" placeholder="Max" value={rule.max_weight || ""} onChange={e => {
                                    const rules = [...formData.pricing_rules];
                                    rules[formData.pricing_rules.indexOf(rule)].max_weight = e.target.value || null;
                                    setFormData({...formData, pricing_rules: rules});
                                  }} className="w-full text-xs rounded border border-slate-200 p-1 dark:bg-dark-surface dark:border-dark-border dark:text-white" />
                                </div>
                              </div>
                              <div className="w-24">
                                <label className="block text-[10px] font-bold text-slate-400 uppercase">Result Fee (₱)</label>
                                <input required type="number" step="0.01" value={rule.price} onChange={e => {
                                  const rules = [...formData.pricing_rules];
                                  rules[formData.pricing_rules.indexOf(rule)].price = e.target.value;
                                  setFormData({...formData, pricing_rules: rules});
                                }} className="w-full text-xs font-bold rounded border border-slate-200 p-1 dark:bg-dark-surface dark:border-dark-border dark:text-white" />
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                      <p className="mt-3 text-[10px] text-blue-600 dark:text-blue-500 italic">Rules are evaluated top-down. The first matching rule applies.</p>
                    </div>
                  )}

                  {formData.pricing_type === 'size_based' && (
                    <div className="dark:border-dark-border bg-slate-50/50 dark:bg-dark-surface/50 p-3 rounded-xl border">
                      <p className="text-sm font-semibold text-slate-700 dark:text-zinc-300 mb-3">Service Fee per Size Category</p>
                      <div className="space-y-3 max-h-40 overflow-y-auto pr-2">
                        {petSizes.map(size => {
                          const rule = formData.pricing_rules.find(r => r.basis_type === 'size' && r.reference_id === size.id);
                          return (
                            <div key={size.id} className="flex items-center justify-between gap-4">
                              <span className="text-sm text-slate-600 dark:text-zinc-400">{size.name}</span>
                              <div className="relative">
                                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-xs">₱</span>
                                <input 
                                  type="number" required placeholder="0.00" value={rule?.price || ""} 
                                  onChange={e => {
                                    const otherRules = formData.pricing_rules.filter(r => !(r.basis_type === 'size' && r.reference_id === size.id));
                                    setFormData({...formData, pricing_rules: [...otherRules, { basis_type: 'size', reference_id: size.id, price: e.target.value }]});
                                  }}
                                  className="w-32 rounded-xl border border-slate-200 py-2 pl-7 pr-3 text-sm focus:border-blue-500 focus:outline-none dark:bg-dark-surface dark:border-dark-border dark:text-white" 
                                />
                              </div>
                            </div>
                          )
                        })}
                      </div>
                    </div>
                  )}

                  {formData.pricing_type === 'weight_based' && (
                    <div className="dark:border-dark-border bg-slate-50/50 dark:bg-dark-surface/50 p-3 rounded-xl border">
                      <p className="text-sm font-semibold text-slate-700 dark:text-zinc-300 mb-1">Service Fee by Mapped Weight</p>
                      <div className="space-y-3 max-h-48 overflow-y-auto pr-2">
                        {petSizes.map(size => {
                          const rule = formData.pricing_rules.find(r => r.basis_type === 'size' && r.reference_id === size.id);
                          return (
                            <div key={size.id} className="flex items-center justify-between gap-4">
                              <span className="text-sm text-slate-600 dark:text-zinc-400">{size.name}</span>
                              <div className="relative">
                                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-xs">₱</span>
                                <input 
                                  type="number" required placeholder="0.00" value={rule?.price || ""} 
                                  onChange={e => {
                                    const otherRules = formData.pricing_rules.filter(r => !(r.basis_type === 'size' && r.reference_id === size.id));
                                    setFormData({...formData,  pricing_rules: [...otherRules, { basis_type: 'size', reference_id: size.id, price: e.target.value }]});
                                  }}
                                  className="w-32 rounded-xl border border-slate-200 py-2 pl-7 pr-3 text-sm focus:border-blue-500 focus:outline-none dark:bg-dark-surface dark:border-dark-border dark:text-white" 
                                />
                              </div>
                            </div>
                          )
                        })}
                      </div>
                    </div>
                  )}

                  <div className="mt-4 border border-slate-200 dark:border-dark-border rounded-xl p-4 space-y-3">
                    <p className="text-sm font-bold text-slate-800 dark:text-zinc-200 mb-2">Invoice Auto-Behavior</p>
                    <label className="flex items-center gap-3 cursor-pointer">
                      <input type="checkbox" checked={formData.show_on_invoice} onChange={e => setFormData({...formData, show_on_invoice: e.target.checked})} className="h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-600" />
                      <div>
                        <p className="text-sm font-semibold text-slate-700 dark:text-zinc-300">Show Service Fee on Invoice</p>
                        <p className="text-xs text-slate-500">Uncheck to keep this an internal-only tracking service.</p>
                      </div>
                    </label>
                    <label className="flex items-center gap-3 cursor-pointer border-t border-slate-100 dark:border-dark-border pt-3">
                      <input type="checkbox" checked={formData.auto_load_linked_items} onChange={e => setFormData({...formData, auto_load_linked_items: e.target.checked})} className="h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-600" />
                      <div>
                        <p className="text-sm font-semibold text-slate-700 dark:text-zinc-300">Auto-Load Linked Items</p>
                        <p className="text-xs text-slate-500">Automatically add the consumables listed below to the invoice when this service is selected.</p>
                      </div>
                    </label>
                    <label className="flex items-center gap-3 cursor-pointer border-t border-slate-100 dark:border-dark-border pt-3">
                      <input type="checkbox" checked={formData.allow_manual_item_override} onChange={e => setFormData({...formData, allow_manual_item_override: e.target.checked})} className="h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-600" />
                      <div>
                        <p className="text-sm font-semibold text-slate-700 dark:text-zinc-300">Allow Manual Item Overrides</p>
                        <p className="text-xs text-slate-500">Allow staff to optionally add, remove, or edit linked items in the invoice module.</p>
                      </div>
                    </label>
                  </div>
                </div>

                {/* Pricing & Linked Items Preview */}
                <div className="mt-6 border-t border-slate-200 dark:border-dark-border pt-4 bg-slate-50 dark:bg-dark-surface/30 p-4 rounded-xl">
                  <h5 className="text-xs font-bold text-slate-500 uppercase mb-3 text-center sm:text-left">Billing Preview Summary</h5>
                  <div className="space-y-3">
                    <div className="flex justify-between text-sm">
                      <span className="text-slate-600 dark:text-zinc-400 font-medium">Professional Fee (Vet Labor):</span>
                      <span className="font-bold text-slate-900 dark:text-zinc-100">
                        {formData.pricing_type === 'fixed' ? `₱${Number(formData.professional_fee || 0).toLocaleString("en-PH", { minimumFractionDigits: 2 })}` : 'Dynamic (Rule Resolved)'}
                      </span>
                    </div>

                    <div className="border-t border-slate-100 dark:border-dark-border pt-3">
                      <div className="flex justify-between text-sm mb-2">
                         <span className="text-slate-600 dark:text-zinc-400 font-medium">Linked Consumable Cost (Internal):</span>
                         <span className="font-bold text-emerald-600 dark:text-emerald-400">
                           ₱{formData.linked_items.reduce((acc, li) => {
                             const inv = inventories.find(i => i.id === Number(li.inventory_id));
                             return acc + ((Number(inv?.price) || 0) * Number(li.quantity || 0));
                           }, 0).toLocaleString("en-PH", { minimumFractionDigits: 2 })}
                         </span>
                      </div>
                      
                      {formData.linked_items.length > 0 && (
                        <div className="pl-3 space-y-1 mt-2">
                          {formData.linked_items.map((li, idx) => {
                            const inv = inventories.find(i => i.id === Number(li.inventory_id));
                            if (!inv) return null;
                            const lineCost = (Number(inv.price) || 0) * Number(li.quantity || 0);
                            return (
                              <div key={idx} className="flex justify-between text-[11px] text-slate-500 italic">
                                <span>• {li.quantity}x {inv.item_name} (@₱{Number(inv.price || 0).toFixed(2)})</span>
                                <span>₱{lineCost.toFixed(2)}</span>
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>

                    <div className="border-t-2 border-slate-200 dark:border-dark-border pt-4 flex justify-between font-black text-base text-blue-600 dark:text-blue-400 uppercase tracking-tight">
                      <span>Estimated Service Total:</span>
                      <span>
                        {formData.pricing_type === 'fixed' 
                          ? `₱${(
                              Number(formData.professional_fee || 0) + 
                              formData.linked_items.reduce((acc, li) => {
                                const inv = inventories.find(i => i.id === Number(li.inventory_id));
                                return acc + ((Number(inv?.price) || 0) * Number(li.quantity || 0));
                              }, 0)
                            ).toLocaleString("en-PH", { minimumFractionDigits: 2 })}`
                          : (
                            <span className="text-xs normal-case font-bold">
                              Computed at Invoice + ₱{formData.linked_items.reduce((acc, li) => {
                                const inv = inventories.find(i => i.id === Number(li.inventory_id));
                                return acc + ((Number(inv?.price) || 0) * Number(li.quantity || 0));
                              }, 0).toFixed(2)} Items
                            </span>
                          )}
                      </span>
                    </div>
                  </div>
                </div>
              </section>

              {/* SECTION C: Linked Consumables */}
              {LINKED_ITEM_ELIGIBLE_CATEGORIES.includes(formData.category) ? (
              <section>
                <div className="flex items-center justify-between mb-4 border-b pb-2 dark:border-dark-border">
                  <h4 className="text-md font-bold text-slate-900 dark:text-zinc-50">C. Linked Items / Consumables</h4>
                  <button type="button" onClick={() => setFormData({...formData, linked_items: [...formData.linked_items, { inventory_id: "", quantity: 1, is_billable: true, is_required: false, auto_deduct: true, notes: "" }]})} className="text-xs font-semibold text-blue-600 dark:text-blue-400 hover:underline flex items-center gap-1">
                    <FiPlus /> Add Item
                  </button>
                </div>
                
                <div className="space-y-4">
                  {formData.linked_items.map((li, idx) => {
                    const inv = inventories.find(i => i.id === Number(li.inventory_id));
                    const costPrice = Number(inv?.price || 0);
                    const lineTotalCost = costPrice * Number(li.quantity || 0);

                    return (
                    <div key={idx} className="p-4 border border-slate-200 dark:border-dark-border rounded-xl bg-slate-50 dark:bg-dark-surface/50 space-y-4">
                      <div className="flex items-start gap-3">
                        <div className="flex-1">
                          <label className="block text-xs font-semibold text-slate-500 mb-1">Inventory Item / Consumable *</label>
                          <select required value={li.inventory_id} onChange={e => {
                            const val = e.target.value;
                            if (val && formData.linked_items.some((item, sidx) => sidx !== idx && item.inventory_id == val)) {
                              toast.error("This item is already linked to this service.");
                              return;
                            }
                            const newItems = [...formData.linked_items];
                            newItems[idx].inventory_id = val;
                            setFormData({...formData, linked_items: newItems});
                          }} className="w-full rounded-lg border border-slate-200 p-2 text-sm focus:border-blue-500 focus:outline-none dark:bg-dark-surface dark:border-dark-border dark:text-white">
                            <option value="">Select inventory item</option>
                            {inventories.filter(i => {
                              const cat = i.inventory_category?.name || "";
                              const eligibleCats = ["Consumables", "Medicines", "Vaccines", "Grooming Supplies", "Preventive Care Supplies", "Supplies"];
                              return i.is_consumable || eligibleCats.includes(cat);
                            }).map(i => (
                              <option key={i.id} value={i.id}>{i.item_name} [{i.inventory_category?.name || 'Item'}]</option>
                            ))}
                          </select>
                        </div>
                        <div className="w-24 shrink-0">
                          <label className="block text-xs font-semibold text-slate-500 mb-1">Def. Qty *</label>
                          <input required min="0.01" step="0.01" type="number" value={li.quantity} onChange={e => {
                            const newItems = [...formData.linked_items];
                            newItems[idx].quantity = e.target.value;
                            setFormData({...formData, linked_items: newItems});
                          }} className="w-full rounded-lg border border-slate-200 p-2 text-sm focus:border-blue-500 focus:outline-none dark:bg-dark-surface dark:border-dark-border dark:text-white" />
                        </div>
                        <button type="button" onClick={() => {
                          const newItems = [...formData.linked_items];
                          newItems.splice(idx, 1);
                          setFormData({...formData, linked_items: newItems});
                        }} className="mt-6 text-rose-500 hover:text-rose-700 p-2 rounded-lg hover:bg-rose-50 dark:hover:bg-rose-900/30">
                          <FiTrash2 size={16} />
                        </button>
                      </div>

                      {/* Cost Display Block */}
                      {inv && (
                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 bg-white dark:bg-dark-card p-3 rounded-lg border dark:border-dark-border shadow-sm">
                           <div>
                             <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Cost Price</p>
                             <p className={clsx("text-sm font-bold", costPrice === 0 ? "text-rose-500" : "text-slate-700 dark:text-zinc-200")}>
                               ₱{costPrice.toLocaleString("en-PH", { minimumFractionDigits: 2 })}
                               {costPrice === 0 && <span className="ml-1 text-[8px] animate-pulse">(Missing!)</span>}
                             </p>
                           </div>
                           <div>
                             <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Unit</p>
                             <p className="text-sm font-medium text-slate-600 dark:text-zinc-400">{inv.unit || 'unit(s)'}</p>
                           </div>
                           <div>
                             <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Line Qty</p>
                             <p className="text-sm font-medium text-slate-600 dark:text-zinc-400">{li.quantity}</p>
                           </div>
                           <div className="text-right">
                             <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Subtotal Cost</p>
                             <p className="text-sm font-black text-emerald-600 dark:text-emerald-400">₱{lineTotalCost.toLocaleString("en-PH", { minimumFractionDigits: 2 })}</p>
                           </div>
                        </div>
                      )}
                      
                      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                         <label className="flex items-center gap-2 cursor-pointer bg-white dark:bg-dark-card border dark:border-dark-border p-2 rounded-lg text-sm transition-colors hover:bg-blue-50/50 dark:hover:bg-blue-900/10">
                           <input type="checkbox" checked={li.is_billable} onChange={e => {
                             const newItems = [...formData.linked_items];
                             newItems[idx].is_billable = e.target.checked;
                             setFormData({...formData, linked_items: newItems});
                           }} className="h-3.5 w-3.5 rounded border-slate-300 text-blue-600 focus:ring-blue-600" />
                           <span className="font-medium text-slate-700 dark:text-zinc-300">Billable to Client</span>
                         </label>
                         <label className="flex items-center gap-2 cursor-pointer bg-white dark:bg-dark-card border dark:border-dark-border p-2 rounded-lg text-sm transition-colors hover:bg-blue-50/50 dark:hover:bg-blue-900/10">
                           <input type="checkbox" checked={li.auto_deduct} onChange={e => {
                             const newItems = [...formData.linked_items];
                             newItems[idx].auto_deduct = e.target.checked;
                             setFormData({...formData, linked_items: newItems});
                           }} className="h-3.5 w-3.5 rounded border-slate-300 text-blue-600 focus:ring-blue-600" />
                           <span className="font-medium text-slate-700 dark:text-zinc-300">Auto-Deduct Stock</span>
                         </label>
                         <label className="flex items-center gap-2 cursor-pointer bg-white dark:bg-dark-card border dark:border-dark-border p-2 rounded-lg text-sm transition-colors hover:bg-blue-50/50 dark:hover:bg-blue-900/10">
                           <input type="checkbox" checked={li.is_required} onChange={e => {
                             const newItems = [...formData.linked_items];
                             newItems[idx].is_required = e.target.checked;
                             setFormData({...formData, linked_items: newItems});
                           }} className="h-3.5 w-3.5 rounded border-slate-300 text-blue-600 focus:ring-blue-600" />
                           <span className="font-medium text-slate-700 dark:text-zinc-300">Required Item</span>
                         </label>
                      </div>
                      <div>
                        <input type="text" placeholder="Internal notes (e.g., standard dosage or preparation details)..." value={li.notes} onChange={e => {
                             const newItems = [...formData.linked_items];
                             newItems[idx].notes = e.target.value;
                             setFormData({...formData, linked_items: newItems});
                           }} className="w-full bg-white dark:bg-dark-card rounded-lg border border-slate-200 p-2 text-xs focus:border-blue-500 focus:outline-none dark:border-dark-border dark:text-white" />
                      </div>
                    </div>
                  );})}
                  {formData.linked_items.length === 0 && (
                    <div className="text-center py-6 bg-slate-50 dark:bg-dark-surface/50 rounded-xl border border-dashed border-slate-300 dark:border-dark-border">
                      <p className="text-sm text-slate-500">No linked items configured.</p>
                      <button type="button" onClick={() => setFormData({...formData, linked_items: [...formData.linked_items, { inventory_id: "", quantity: 1, is_billable: true, is_required: false, auto_deduct: true, notes: "" }]})} className="mt-2 text-xs font-semibold text-blue-600 hover:text-blue-700 dark:text-blue-400">Add first linked item</button>
                    </div>
                  )}
                </div>
              </section>
              ) : (
                <section>
                  <div className="flex items-center justify-between mb-2">
                    <h4 className="text-md font-bold text-slate-900 dark:text-zinc-50">C. Linked Items / Consumables</h4>
                  </div>
                  <div className="p-4 bg-slate-50 dark:bg-dark-surface/50 border border-slate-200 dark:border-dark-border rounded-xl">
                    <p className="text-sm text-slate-500 dark:text-zinc-400">This category is service-fee only and does not support linked inventory items.</p>
                  </div>
                </section>
              )}
            </form>
            
            <div className="p-6 border-t border-slate-200 dark:border-dark-border shrink-0 flex justify-end gap-3 bg-slate-50 dark:bg-dark-surface/30 rounded-b-2xl">
              <button type="button" onClick={handleCloseModal} className="px-4 py-2 font-semibold text-slate-600 hover:text-slate-800 dark:text-zinc-300">Cancel</button>
              <button onClick={handleSave} type="button" className="flex items-center gap-2 rounded-xl bg-blue-600 px-6 py-2 font-semibold text-white hover:bg-blue-700"><FiSave/> Save Configuration</button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
