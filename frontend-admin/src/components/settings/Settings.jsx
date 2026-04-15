import clsx from "clsx";
import { useState, useEffect, useCallback, useRef } from "react";
import { FiHome, FiSettings, FiUsers, FiBriefcase, FiArchive, FiActivity, FiDatabase, FiRefreshCw } from "react-icons/fi";
import api from "../../utils/api";
import { useAuth } from "../../context/AuthContext";

import ClinicProfileTab from "./ClinicProfileTab";
import UserManagementTab from "./UserManagementTab";
import ServiceManagementTab from "./ServiceManagementTab";
import MasterDataManagementTab from "./MasterDataManagementTab";
import SystemPreferencesTab from "./SystemPreferencesTab";
import ArchiveRecoveryTab from "./ArchiveRecoveryTab";
import AuditLogTab from "./AuditLogTab";
import BackupRestoreTab from "./BackupRestoreTab";

import SpeciesBreedsTab from "./SpeciesBreedsTab";
import VetScheduleTab from "./VetScheduleTab";
import NotificationTemplatesManager from "../notifications/NotificationTemplatesManager";

const tabs = [
  { id: "clinic", label: "Clinic Profile", icon: FiHome },
  { id: "data", label: "Master Data", icon: FiSettings },
  { id: "services", label: "Service Management", icon: FiBriefcase },
  { id: "species", label: "Species & Breeds", icon: FiHome },
  { id: "users", label: "Users / Roles", icon: FiUsers },
  { id: "schedule", label: "Vet Schedule", icon: FiBriefcase },
  { id: "system", label: "System & AI Preferences", icon: FiSettings },
  { id: "audit", label: "System Audit Logs", icon: FiActivity },
  { id: "backup", label: "Backup & Restore", icon: FiDatabase },
  { id: "archive", label: "Archive & Recovery", icon: FiArchive },
  { id: "client_notifications", label: "Notification Templates", icon: FiSettings },
];

function Settings() {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState("data");
  
  // Shared Master Data State
  const [masterData, setMasterData] = useState({
    species: [],
    serviceCategories: [],
    petSizes: [],
    weightRanges: [],
    inventory: [],
    inventoryCategories: [],
    units: [],
    loading: true,
    error: null
  });

  const [fetchedTabs, setFetchedTabs] = useState(new Set());
  const fetchingRef = useRef(new Set());

  const fetchMasterData = useCallback(async (targets = ['core']) => {
    if (!user?.token) return;
    
    // Check if we are already fetching these targets to avoid redundancy
    const newTargets = targets.filter(t => !fetchingRef.current.has(t));
    if (newTargets.length === 0) return;
    
    // Mark as fetching
    newTargets.forEach(t => fetchingRef.current.add(t));
    
    // Determine what to fetch
    const fetchSpecies = newTargets.includes('core') || newTargets.includes('data') || newTargets.includes('species') || newTargets.includes('services');
    const fetchPetSizes = newTargets.includes('core') || newTargets.includes('data') || newTargets.includes('species') || newTargets.includes('services');
    const fetchServiceCats = newTargets.includes('services') || newTargets.includes('data');
    const fetchWeightRanges = newTargets.includes('services') || newTargets.includes('data');
    const fetchInventory = newTargets.includes('services');
    const fetchInventoryCats = newTargets.includes('data');
    const fetchUnits = newTargets.includes('data');

    setMasterData(prev => ({ ...prev, loading: true, error: null }));
    
    try {
      const promises = [];
      const keys = [];

      if (fetchSpecies) { promises.push(api.get("/api/species")); keys.push('species'); }
      if (fetchServiceCats) { promises.push(api.get("/api/service-categories")); keys.push('serviceCategories'); }
      if (fetchPetSizes) { promises.push(api.get("/api/pet-size-categories")); keys.push('petSizes'); }
      if (fetchWeightRanges) { promises.push(api.get("/api/weight-ranges?per_page=100")); keys.push('weightRanges'); }
      if (fetchInventory) { promises.push(api.get("/api/inventory?per_page=100")); keys.push('inventory'); }
      if (fetchInventoryCats) { promises.push(api.get("/api/inventory-categories")); keys.push('inventoryCategories'); }
      if (fetchUnits) { promises.push(api.get("/api/units-of-measure")); keys.push('units'); }

      const results = await Promise.all(promises);
      
      setMasterData(prev => {
        const newData = { ...prev };
        results.forEach((res, i) => {
          const key = keys[i];
          newData[key] = res.data?.data || res.data || [];
        });
        return {
          ...newData,
          loading: false,
          error: null
        };
      });

      setFetchedTabs(prev => {
        const next = new Set(prev);
        newTargets.forEach(t => next.add(t));
        return next;
      });
    } catch (err) {
      console.error("[Settings] Data sync failed:", err);
      // Remove from fetchingRef so we can retry later
      newTargets.forEach(t => fetchingRef.current.delete(t));
      
      setMasterData(prev => ({ 
        ...prev, 
        loading: false, 
        error: "Failed to sync reference data. Some features restricted." 
      }));
    } finally {
       // Only remove 'loading' if we actually fetched something or failed
       // The individual targets remain in fetchingRef (if success) or removed (if fail)
    }
  }, [user?.token]);

  useEffect(() => {
    fetchMasterData(['core']);
  }, []); // Only on mount

  useEffect(() => {
    if (!fetchedTabs.has(activeTab)) {
      fetchMasterData([activeTab]);
    }
  }, [activeTab, fetchedTabs, fetchMasterData]);

  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-[220px_1fr]">
      <aside className="sticky top-24 h-fit space-y-4">
        <div className="card-shell p-2">
          <nav className="space-y-1">
            {tabs.map((tab) => {
              const Icon = tab.icon;
              const active = tab.id === activeTab;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={clsx(
                    "group flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-sm font-semibold transition-all duration-200",
                    active 
                      ? "bg-emerald-600 text-white shadow-lg shadow-emerald-500/20" 
                      : "text-zinc-600 hover:bg-zinc-100 hover:text-zinc-900 dark:text-zinc-400 dark:hover:bg-dark-surface dark:hover:text-zinc-100"
                  )}
                >
                  <Icon className={clsx("h-4 w-4 shrink-0 transition-transform duration-200", active && "scale-110")} />
                  <span className="truncate">{tab.label}</span>
                </button>
              );
            })}
          </nav>
        </div>
        
        {/* Help/Inspiration Card (Optional but looks premium) */}
        <div className="rounded-2xl bg-gradient-to-br from-emerald-600 to-indigo-700 p-4 text-white shadow-xl shadow-emerald-500/10">
          <p className="text-xs font-bold uppercase tracking-wider opacity-60">Pro Tip</p>
          <p className="mt-1 text-xs leading-relaxed font-medium">
            Use Master Data to standardize categories across the entire clinic workflow.
          </p>
        </div>
      </aside>

      <main className="min-w-0">
        {masterData.error && (
          <div className="mb-6 flex items-center justify-between rounded-xl bg-red-50 p-4 border border-red-100 dark:bg-red-900/10 dark:border-red-900/20">
            <div className="flex items-center gap-3">
              <div className="text-red-600 dark:text-red-400">
                <FiActivity size={20} />
              </div>
              <p className="text-sm font-medium text-red-800 dark:text-red-400">{masterData.error}</p>
            </div>
            <button 
              onClick={() => fetchMasterData(['core', activeTab])}
              className="flex items-center gap-2 rounded-lg bg-red-100 px-3 py-1.5 text-xs font-bold text-red-700 hover:bg-red-200 transition-colors"
            >
              <FiRefreshCw /> Retry Sync
            </button>
          </div>
        )}

        {activeTab === "clinic" && <ClinicProfileTab />}
        {activeTab === "data" && (
          <MasterDataManagementTab 
            masterData={masterData} 
            onRefetch={fetchMasterData} 
          />
        )}
        {activeTab === "services" && (
          <ServiceManagementTab 
            masterData={masterData} 
            onRefetch={fetchMasterData} 
          />
        )}
        {activeTab === "species" && (
          <SpeciesBreedsTab 
            masterData={masterData} 
            onRefetch={fetchMasterData} 
          />
        )}
        {activeTab === "users" && <UserManagementTab />}
        { activeTab === "schedule" && <VetScheduleTab /> }
        { activeTab === "system" && <SystemPreferencesTab /> }
        { activeTab === "audit" && <AuditLogTab /> }
        { activeTab === "backup" && <BackupRestoreTab /> }
        { activeTab === "archive" && <ArchiveRecoveryTab /> }
        { activeTab === "client_notifications" && <NotificationTemplatesManager /> }
      </main>
    </div>
  );
}

export default Settings;
