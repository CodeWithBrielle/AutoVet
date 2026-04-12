import {
  FiCalendar,
  FiClipboard,
  FiCreditCard,
  FiGrid,
  FiPackage,
  FiSettings,
  FiBarChart2,
  FiMail,
} from "react-icons/fi";
import { LuPawPrint } from "react-icons/lu";
import { ROLES, ALL_ROLES, FULL_ACCESS_ROLES } from "../constants/roles";

export const primaryNavigation = [
  { id: "dashboard", label: "Dashboard", path: "/", icon: FiGrid, allowedRoles: ALL_ROLES },
  { id: "patients", label: "Patients", path: "/patients", icon: LuPawPrint, allowedRoles: ALL_ROLES },
  { id: "appointments", label: "Appointments", path: "/appointments", icon: FiClipboard, allowedRoles: ALL_ROLES },
  { id: "inventory", label: "Inventory", path: "/inventory", icon: FiPackage, badge: "AI", allowedRoles: ALL_ROLES },
  { id: "invoices", label: "Invoices", path: "/invoices", icon: FiCreditCard, allowedRoles: ALL_ROLES },
  { id: "reports", label: "Reports", path: "/reports", icon: FiBarChart2, allowedRoles: FULL_ACCESS_ROLES },
  { id: "sent-notifications", label: "Sent Notifications", path: "/client-notifications", icon: FiMail, allowedRoles: ALL_ROLES },
];

export const bottomNavigation = [
  { id: "maintenance", label: "Maintenance", path: "/settings", icon: FiSettings, allowedRoles: FULL_ACCESS_ROLES },
];

export const clinicInfo = {
  name: "AutoVet",
  subtitle: "Clinic Manager",
};

export const currentUser = {
  name: "Dr. Sarah Smith",
  role: ROLES.VETERINARIAN,
  // Local fallback avatar — works offline. Real avatar comes from AuthContext (API).
  avatar: "/images/fallbacks/user-vet.svg",
};
