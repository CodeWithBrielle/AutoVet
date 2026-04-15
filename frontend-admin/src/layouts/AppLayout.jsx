import React, { useMemo, useState } from "react";
import { Outlet, useMatches, useNavigate } from "react-router-dom";
import Sidebar from "../components/layout/Sidebar";
import TopHeader from "../components/layout/TopHeader";
import {
  bottomNavigation,
  clinicInfo,
  primaryNavigation,
} from "../config/navigation";
import { useAuth } from "../context/AuthContext";
import { ROLES } from "../constants/roles";
import api from "../utils/api";

function AppLayout() {
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [clinic, setClinic] = useState(clinicInfo);
  const matches = useMatches();
  const navigate = useNavigate();
  const { user, loading, login: setUser } = useAuth();
  const [isMaintenance, setIsMaintenance] = useState(false);

  // Redundant redirect logic removed as it is now handled by ProtectedRoute in router.jsx

  // Fetch clinic settings once on mount or when token changes
  React.useEffect(() => {
    let isMounted = true;

    if (user?.token) {
      api.get("/api/settings")
        .then((res) => {
          if (!isMounted) return;
          const data = res.data;
          if (data && typeof data === 'object') {
            if (data.clinic_name) {
              const name = typeof data.clinic_name === 'string' ? data.clinic_name : String(data.clinic_name?.message || data.clinic_name?.text || 'Pet Wellness');
              setClinic((prev) => ({ ...prev, name }));
            }
            if (data.clinic_logo && typeof data.clinic_logo === 'string') {
              setClinic((prev) => ({ ...prev, logo: data.clinic_logo }));
            }
          }
        })
        .catch(err => {
          if (isMounted) {
            console.error("AppLayout: Settings fetch error:", err);
          }
        });
    }

    return () => {
      isMounted = false;
    };
  }, [user?.token]);

  const pageTitle = useMemo(() => {
    const titledMatch = [...matches].reverse().find((match) => match.handle?.title);
    return titledMatch?.handle?.title ?? "Pet Wellness";
  }, [matches]);

  // Redundant loading/user check removed as ProtectedRoute guards the entire layout.

  if (isMaintenance && user?.role !== ROLES.ADMIN) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-zinc-50 p-6 text-center dark:bg-dark-bg">
        <div className="mb-4 rounded-full bg-amber-100 p-4 dark:bg-amber-900/30">
          <svg className="h-10 w-10 text-amber-600 dark:text-amber-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
          </svg>
        </div>
        <h1 className="text-3xl font-bold tracking-tight text-zinc-900 dark:text-zinc-50">System Under Maintenance</h1>
        <p className="mt-2 max-w-md text-zinc-500 dark:text-zinc-400">
          We are currently performing routine maintenance. Please check back later.
        </p>
      </div>
    );
  }


  const filteredPrimaryNav = useMemo(() => {
    if (!user || !user.role) return [];
    return primaryNavigation.filter((item) => item.allowedRoles?.includes(user.role));
  }, [user]);

  const filteredBottomNav = useMemo(() => {
    if (!user || !user.role) return [];
    return bottomNavigation.filter((item) => item.allowedRoles?.includes(user.role));
  }, [user]);

  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-dark-bg transition-colors duration-300">
      <Sidebar
        items={filteredPrimaryNav}
        bottomItems={filteredBottomNav}
        clinic={clinic}
        user={user}
        isOpen={isSidebarOpen}
        onClose={() => setIsSidebarOpen(false)}
      />

      <div className="md:pl-64 flex flex-col min-h-screen">
        <TopHeader
          title={pageTitle}
          user={user}
          clinic={clinic}
          onMenuToggle={() => setIsSidebarOpen((prev) => !prev)}
        />

        <main className="flex-1 w-full p-4 sm:p-6 lg:p-10 mx-auto">
          <Outlet context={{ user, setUser }} />
        </main>
      </div>
    </div>
  );
}

export default AppLayout;

