import { useState, useEffect } from "react";
import { FiSave, FiPlus, FiEdit2, FiTrash2, FiSearch, FiX } from "react-icons/fi";
import { useToast } from "../../context/ToastContext";
import clsx from "clsx";

export default function DataManagementTab() {
  const toast = useToast();
<<<<<<< Updated upstream
  const [speciesList, setSpeciesList] = useState([]);
  const [categoryList, setCategoryList] = useState([]);
  const [serviceCategoryList, setServiceCategoryList] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [newSpecies, setNewSpecies] = useState("");
  const [newCategory, setNewCategory] = useState("");
  const [newServiceCategory, setNewServiceCategory] = useState("");

  useEffect(() => {
    fetch("/api/settings")
      .then((res) => res.json())
      .then((data) => {
        try {
          setSpeciesList(data.species_list ? JSON.parse(data.species_list) : ["Canine", "Feline", "Avian", "Reptile", "Exotic", "Other"]);
          setCategoryList(data.inventory_categories ? JSON.parse(data.inventory_categories) : ["Vaccines", "Antibiotics", "Supplies", "Diagnostics"]);
          setServiceCategoryList(data.service_categories ? JSON.parse(data.service_categories) : ["Consultation", "Grooming", "Surgery", "Diagnostics"]);
        } catch {
          setSpeciesList(["Canine", "Feline", "Avian", "Reptile", "Exotic", "Other"]);
          setCategoryList(["Vaccines", "Antibiotics", "Supplies", "Diagnostics"]);
          setServiceCategoryList(["Consultation", "Grooming", "Surgery", "Diagnostics"]);
        }
        setLoading(false);
      })
      .catch((err) => {
        console.error(err);
        setLoading(false);
      });
  }, []);

  const handleSave = async () => {
    setIsSaving(true);
    try {
      await fetch("/api/settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json", "Accept": "application/json" },
        body: JSON.stringify({
          settings: {
            species_list: JSON.stringify(speciesList),
            inventory_categories: JSON.stringify(categoryList),
            service_categories: JSON.stringify(serviceCategoryList)
          }
        })
=======
  
  // States for Inventory Categories
  const [inventoryCategories, setInventoryCategories] = useState([]);
  const [invSearch, setInvSearch] = useState("");
  const [invLoading, setInvLoading] = useState(true);

  // States for Service Categories
  const [serviceCategories, setServiceCategories] = useState([]);
  const [svcSearch, setSvcSearch] = useState("");
  const [svcLoading, setSvcLoading] = useState(true);

  // Modal States
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [modalType, setModalType] = useState("inventory"); // "inventory" or "service"
  const [editingCategory, setEditingCategory] = useState(null);
  const [formData, setFormData] = useState({ name: "", description: "", type: "", status: "Active" });

  useEffect(() => {
    fetchInventoryCategories();
    fetchServiceCategories();
  }, []);

  const fetchInventoryCategories = () => {
    setInvLoading(true);
    fetch("/api/inventory-categories")
      .then(res => res.json())
      .then(data => { setInventoryCategories(data); setInvLoading(false); })
      .catch(() => { toast.error("Failed to load inventory categories"); setInvLoading(false); });
  };

  const fetchServiceCategories = () => {
    setSvcLoading(true);
    fetch("/api/service-categories")
      .then(res => res.json())
      .then(data => { setServiceCategories(data); setSvcLoading(false); })
      .catch(() => { toast.error("Failed to load service categories"); setSvcLoading(false); });
  };

  const handleOpenModal = (type, category = null) => {
    setModalType(type);
    if (category) {
      setEditingCategory(category);
      setFormData({
        name: category.name,
        description: category.description || "",
        type: category.type || "",
        status: category.status
>>>>>>> Stashed changes
      });
    } else {
      setEditingCategory(null);
      setFormData({ name: "", description: "", type: "", status: "Active" });
    }
    setIsModalOpen(true);
  };

<<<<<<< Updated upstream
  const handleAddSpecies = (e) => {
    e.preventDefault();
    const name = newSpecies.trim();
    if (name && !speciesList.includes(name)) {
      setSpeciesList([...speciesList, name]);
      setNewSpecies("");
    }
  };

  const handleAddCategory = (e) => {
    e.preventDefault();
    const name = newCategory.trim();
    if (name && !categoryList.includes(name)) {
      setCategoryList([...categoryList, name]);
      setNewCategory("");
    }
  };

  const handleAddServiceCategory = (e) => {
    e.preventDefault();
    const name = newServiceCategory.trim();
    if (name && !serviceCategoryList.includes(name)) {
      setServiceCategoryList([...serviceCategoryList, name]);
      setNewServiceCategory("");
    }
  };

  if (loading) return <div className="p-6 text-slate-500">Loading data management...</div>;

  return (
    <section className="card-shell p-6">
      <h3 className="text-2xl font-bold text-slate-900 dark:text-zinc-50">Data Management</h3>
      <p className="mt-1 text-sm text-slate-500 dark:text-zinc-400">Manage dynamic list values used across the clinic system.</p>

      <div className="mt-8 grid grid-cols-1 gap-8 lg:grid-cols-2">
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h4 className="text-lg font-bold text-slate-900 dark:text-zinc-50">Species List</h4>
          </div>
          <form onSubmit={handleAddSpecies} className="flex gap-2">
            <input
              type="text"
              value={newSpecies}
              onChange={(e) => setNewSpecies(e.target.value)}
              placeholder="e.g. Amphibian"
              className="h-10 w-full rounded-lg border border-slate-200 bg-slate-50 px-3 text-sm text-slate-700 focus:border-blue-500 focus:bg-white focus:outline-none dark:border-dark-border dark:bg-dark-surface dark:text-zinc-200"
            />
            <button type="submit" className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700">Add</button>
          </form>
          <div className="flex flex-wrap gap-2">
            {speciesList.map((s) => (
              <span key={s} className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-3 py-1 text-sm font-medium text-slate-700 dark:bg-dark-surface dark:text-zinc-300">
                {s} <button onClick={() => setSpeciesList(speciesList.filter(i => i !== s))} className="ml-1 text-red-500">&times;</button>
              </span>
            ))}
=======
  const handleSave = async (e) => {
    e.preventDefault();
    const isEditing = !!editingCategory;
    const url = isEditing 
      ? `/api/${modalType}-categories/${editingCategory.id}` 
      : `/api/${modalType}-categories`;
    const method = isEditing ? "PUT" : "POST";

    try {
      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json", "Accept": "application/json" },
        body: JSON.stringify(formData)
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || "Failed to save category");
      
      toast.success(`${modalType === 'inventory' ? 'Inventory' : 'Service'} category ${isEditing ? 'updated' : 'created'}`);
      if (modalType === "inventory") fetchInventoryCategories();
      else fetchServiceCategories();
      setIsModalOpen(false);
    } catch (err) {
      toast.error(err.message);
    }
  };

  const handleDelete = async (type, id) => {
    if (!confirm(`Are you sure you want to delete this ${type} category?`)) return;
    try {
      const res = await fetch(`/api/${type}-categories/${id}`, { method: "DELETE" });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.message || "Failed to delete");
      }
      toast.success("Category deleted");
      if (type === "inventory") fetchInventoryCategories();
      else fetchServiceCategories();
    } catch (err) {
      toast.error(err.message);
    }
  };

  const filteredInv = inventoryCategories.filter(c => 
    c.name.toLowerCase().includes(invSearch.toLowerCase())
  );

  const filteredSvc = serviceCategories.filter(c => 
    c.name.toLowerCase().includes(svcSearch.toLowerCase())
  );

  return (
    <div className="space-y-8">
      {/* Inventory Categories Section */}
      <section className="card-shell p-6">
        <div className="flex flex-wrap items-center justify-between gap-4 mb-6">
          <div>
            <h3 className="text-xl font-bold text-slate-900 dark:text-zinc-50">Inventory Categories</h3>
            <p className="text-sm text-slate-500 dark:text-zinc-400">Manage classifications for your clinic stock.</p>
>>>>>>> Stashed changes
          </div>
          <button 
            onClick={() => handleOpenModal("inventory")}
            className="inline-flex items-center gap-2 rounded-xl bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700"
          >
            <FiPlus /> Add Category
          </button>
        </div>

<<<<<<< Updated upstream
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h4 className="text-lg font-bold text-slate-900 dark:text-zinc-50">Inventory Categories</h4>
          </div>
          <form onSubmit={handleAddCategory} className="flex gap-2">
            <input
              type="text"
              value={newCategory}
              onChange={(e) => setNewCategory(e.target.value)}
              placeholder="e.g. Preventatives"
              className="h-10 w-full rounded-lg border border-slate-200 bg-slate-50 px-3 text-sm text-slate-700 focus:border-blue-500 focus:bg-white focus:outline-none dark:border-dark-border dark:bg-dark-surface dark:text-zinc-200"
            />
            <button type="submit" className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700">Add</button>
          </form>
          <div className="flex flex-wrap gap-2">
            {categoryList.map((c) => (
              <span key={c} className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-3 py-1 text-sm font-medium text-slate-700 dark:bg-dark-surface dark:text-zinc-300">
                {c} <button onClick={() => setCategoryList(categoryList.filter(i => i !== c))} className="ml-1 text-red-500">&times;</button>
              </span>
            ))}
          </div>
        </div>

        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h4 className="text-lg font-bold text-slate-900 dark:text-zinc-50">Service Categories</h4>
          </div>
          <form onSubmit={handleAddServiceCategory} className="flex gap-2">
            <input
              type="text"
              value={newServiceCategory}
              onChange={(e) => setNewServiceCategory(e.target.value)}
              placeholder="e.g. Grooming"
              className="h-10 w-full rounded-lg border border-slate-200 bg-slate-50 px-3 text-sm text-slate-700 focus:border-blue-500 focus:bg-white focus:outline-none dark:border-dark-border dark:bg-dark-surface dark:text-zinc-200"
            />
            <button type="submit" className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700">Add</button>
          </form>
          <div className="flex flex-wrap gap-2">
            {serviceCategoryList.map((c) => (
              <span key={c} className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-3 py-1 text-sm font-medium text-slate-700 dark:bg-dark-surface dark:text-zinc-300">
                {c} <button onClick={() => setServiceCategoryList(serviceCategoryList.filter(i => i !== c))} className="ml-1 text-red-500">&times;</button>
              </span>
            ))}
          </div>
        </div>
      </div>

      <button
        onClick={handleSave}
        disabled={isSaving}
        className="mt-8 inline-flex items-center gap-2 rounded-xl bg-blue-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-50"
      >
        <FiSave className="h-4 w-4" />
        {isSaving ? "Saving..." : "Save List Changes"}
      </button>
    </section>
=======
        <div className="mb-4 relative group">
          <FiSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-blue-500 transition-colors" />
          <input 
            type="text"
            placeholder="Search inventory categories..."
            value={invSearch}
            onChange={(e) => setInvSearch(e.target.value)}
            className="w-full h-11 pl-10 pr-4 rounded-xl border border-slate-200 bg-slate-50/50 text-sm focus:border-blue-500 focus:outline-none dark:border-dark-border dark:bg-dark-surface dark:text-zinc-200 transition-all"
          />
        </div>

        <div className="overflow-x-auto border border-slate-200 dark:border-dark-border rounded-xl">
          <table className="w-full text-left border-collapse">
            <thead className="bg-slate-50 dark:bg-dark-surface text-slate-600 dark:text-zinc-400 text-xs font-bold uppercase tracking-wider">
              <tr>
                <th className="px-4 py-3 border-b border-slate-200 dark:border-dark-border">Name</th>
                <th className="px-4 py-3 border-b border-slate-200 dark:border-dark-border">Description</th>
                <th className="px-4 py-3 border-b border-slate-200 dark:border-dark-border">Status</th>
                <th className="px-4 py-3 border-b border-slate-200 dark:border-dark-border text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-dark-border">
              {invLoading ? (
                <tr><td colSpan="4" className="p-8 text-center text-slate-400">Loading...</td></tr>
              ) : filteredInv.length === 0 ? (
                <tr><td colSpan="4" className="p-8 text-center text-slate-400">No categories found.</td></tr>
              ) : filteredInv.map(c => (
                <tr key={c.id} className="hover:bg-slate-50/50 dark:hover:bg-dark-surface/50 transition-colors">
                  <td className="px-4 py-3 text-sm font-semibold text-slate-900 dark:text-zinc-100">{c.name}</td>
                  <td className="px-4 py-3 text-sm text-slate-600 dark:text-zinc-400">{c.description || "-"}</td>
                  <td className="px-4 py-3">
                    <span className={clsx(
                      "inline-flex px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider border",
                      c.status === "Active" 
                        ? "bg-emerald-50 text-emerald-700 border-emerald-100 dark:bg-emerald-950/30 dark:text-emerald-400 dark:border-emerald-900/50"
                        : "bg-slate-50 text-slate-500 border-slate-200 dark:bg-dark-surface dark:text-zinc-500 dark:border-dark-border"
                    )}>
                      {c.status}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <div className="flex justify-end gap-2">
                      <button onClick={() => handleOpenModal("inventory", c)} className="p-2 text-slate-400 hover:text-blue-600 transition-colors"><FiEdit2 size={16}/></button>
                      <button onClick={() => handleDelete("inventory", c.id)} className="p-2 text-slate-400 hover:text-rose-600 transition-colors"><FiTrash2 size={16}/></button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {/* Service Categories Section */}
      <section className="card-shell p-6">
        <div className="flex flex-wrap items-center justify-between gap-4 mb-6">
          <div>
            <h3 className="text-xl font-bold text-slate-900 dark:text-zinc-50">Service Categories</h3>
            <p className="text-sm text-slate-500 dark:text-zinc-400">Manage groups for medical and clinical services.</p>
          </div>
          <button 
            onClick={() => handleOpenModal("service")}
            className="inline-flex items-center gap-2 rounded-xl bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700"
          >
            <FiPlus /> Add Category
          </button>
        </div>

        <div className="mb-4 relative group">
          <FiSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-blue-500 transition-colors" />
          <input 
            type="text"
            placeholder="Search service categories..."
            value={svcSearch}
            onChange={(e) => setSvcSearch(e.target.value)}
            className="w-full h-11 pl-10 pr-4 rounded-xl border border-slate-200 bg-slate-50/50 text-sm focus:border-blue-500 focus:outline-none dark:border-dark-border dark:bg-dark-surface dark:text-zinc-200 transition-all"
          />
        </div>

        <div className="overflow-x-auto border border-slate-200 dark:border-dark-border rounded-xl">
          <table className="w-full text-left border-collapse">
            <thead className="bg-slate-50 dark:bg-dark-surface text-slate-600 dark:text-zinc-400 text-xs font-bold uppercase tracking-wider">
              <tr>
                <th className="px-4 py-3 border-b border-slate-200 dark:border-dark-border">Name</th>
                <th className="px-4 py-3 border-b border-slate-200 dark:border-dark-border">Type</th>
                <th className="px-4 py-3 border-b border-slate-200 dark:border-dark-border">Status</th>
                <th className="px-4 py-3 border-b border-slate-200 dark:border-dark-border text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-dark-border">
              {svcLoading ? (
                <tr><td colSpan="4" className="p-8 text-center text-slate-400">Loading...</td></tr>
              ) : filteredSvc.length === 0 ? (
                <tr><td colSpan="4" className="p-8 text-center text-slate-400">No categories found.</td></tr>
              ) : filteredSvc.map(c => (
                <tr key={c.id} className="hover:bg-slate-50/50 dark:hover:bg-dark-surface/50 transition-colors">
                  <td className="px-4 py-3 text-sm font-semibold text-slate-900 dark:text-zinc-100">{c.name}</td>
                  <td className="px-4 py-3 text-sm text-slate-600 dark:text-zinc-400">{c.type || "-"}</td>
                  <td className="px-4 py-3">
                    <span className={clsx(
                      "inline-flex px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider border",
                      c.status === "Active" 
                        ? "bg-emerald-50 text-emerald-700 border-emerald-100 dark:bg-emerald-950/30 dark:text-emerald-400 dark:border-emerald-900/50"
                        : "bg-slate-50 text-slate-500 border-slate-200 dark:bg-dark-surface dark:text-zinc-500 dark:border-dark-border"
                    )}>
                      {c.status}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <div className="flex justify-end gap-2">
                      <button onClick={() => handleOpenModal("service", c)} className="p-2 text-slate-400 hover:text-blue-600 transition-colors"><FiEdit2 size={16}/></button>
                      <button onClick={() => handleDelete("service", c.id)} className="p-2 text-slate-400 hover:text-rose-600 transition-colors"><FiTrash2 size={16}/></button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {/* Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 backdrop-blur-sm p-4">
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl dark:bg-dark-card border dark:border-white/10 animate-in fade-in zoom-in duration-200">
            <div className="flex items-center justify-between mb-6">
              <div>
                <h3 className="text-xl font-bold text-slate-900 dark:text-zinc-50">
                  {editingCategory ? "Edit" : "New"} {modalType === 'inventory' ? 'Inventory' : 'Service'} Category
                </h3>
              </div>
              <button onClick={() => setIsModalOpen(false)} className="p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-white/5 text-slate-400 transition-colors"><FiX size={20}/></button>
            </div>
            
            <form onSubmit={handleSave} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-500 dark:text-zinc-400 uppercase tracking-wider mb-1.5">Category Name</label>
                <input 
                  required 
                  type="text" 
                  value={formData.name} 
                  onChange={e => setFormData({...formData, name: e.target.value})} 
                  placeholder="e.g. Vaccinations"
                  className="w-full rounded-xl border border-slate-200 p-2.5 text-sm focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 focus:outline-none dark:bg-dark-surface dark:border-dark-border dark:text-white transition-all" 
                />
              </div>

              {modalType === "service" ? (
                <div>
                  <label className="block text-xs font-bold text-slate-500 dark:text-zinc-400 uppercase tracking-wider mb-1.5">Type (Optional)</label>
                  <input 
                    type="text" 
                    value={formData.type} 
                    onChange={e => setFormData({...formData, type: e.target.value})} 
                    placeholder="e.g. Clinical, Diagnostic"
                    className="w-full rounded-xl border border-slate-200 p-2.5 text-sm focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 focus:outline-none dark:bg-dark-surface dark:border-dark-border dark:text-white transition-all" 
                  />
                </div>
              ) : (
                <div>
                  <label className="block text-xs font-bold text-slate-500 dark:text-zinc-400 uppercase tracking-wider mb-1.5">Description (Optional)</label>
                  <textarea 
                    rows="2" 
                    value={formData.description} 
                    onChange={e => setFormData({...formData, description: e.target.value})} 
                    placeholder="Brief description of the category..."
                    className="w-full rounded-xl border border-slate-200 p-2.5 text-sm focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 focus:outline-none dark:bg-dark-surface dark:border-dark-border dark:text-white transition-all" 
                  />
                </div>
              )}

              <div>
                <label className="block text-xs font-bold text-slate-500 dark:text-zinc-400 uppercase tracking-wider mb-1.5">Status</label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setFormData({...formData, status: "Active"})}
                    className={clsx(
                      "py-2 rounded-lg text-sm font-semibold transition-all border",
                      formData.status === "Active" 
                        ? "bg-blue-600 text-white border-blue-600 shadow-lg shadow-blue-500/20" 
                        : "bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100 dark:bg-dark-surface dark:border-dark-border dark:text-zinc-400 dark:hover:bg-dark-surface/80"
                    )}
                  >
                    Active
                  </button>
                  <button
                    type="button"
                    onClick={() => setFormData({...formData, status: "Inactive"})}
                    className={clsx(
                      "py-2 rounded-lg text-sm font-semibold transition-all border",
                      formData.status === "Inactive" 
                        ? "bg-slate-900 text-white border-slate-900 shadow-lg shadow-slate-900/20 dark:bg-zinc-100 dark:text-slate-900 dark:border-zinc-100" 
                        : "bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100 dark:bg-dark-surface dark:border-dark-border dark:text-zinc-400 dark:hover:bg-dark-surface/80"
                    )}
                  >
                    Inactive
                  </button>
                </div>
              </div>

              <div className="flex justify-end gap-3 pt-6 mt-2 border-t border-slate-100 dark:border-white/5">
                <button 
                  type="button" 
                  onClick={() => setIsModalOpen(false)} 
                  className="px-5 py-2 text-sm font-bold text-slate-500 hover:text-slate-700 dark:text-zinc-400 dark:hover:text-zinc-200"
                >
                  Cancel
                </button>
                <button 
                  type="submit" 
                  className="inline-flex items-center gap-2 rounded-xl bg-blue-600 px-6 py-2.5 text-sm font-bold text-white hover:bg-blue-700 shadow-lg shadow-blue-500/20 transition-all active:scale-95"
                >
                  <FiSave size={18} /> Save Changes
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
>>>>>>> Stashed changes
  );
}
