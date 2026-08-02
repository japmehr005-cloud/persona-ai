import type { LucideIcon } from "lucide-react";
import {
  LayoutDashboard,
  ArrowLeftRight,
  ShieldCheck,
  Bell,
  Settings,
  Fingerprint,
  Activity,
  Users,
  FlagTriangleRight,
  BarChart3,
  RadioTower,
  History,
  MapPin,
  ShieldAlert,
  Network,
  Gauge,
  BrainCircuit,
} from "lucide-react";

export interface NavItem {
  label: string;
  href: string;
  icon: LucideIcon;
  children?: { label: string; href: string; icon: LucideIcon }[];
}

export const CUSTOMER_NAV: NavItem[] = [
  { label: "Dashboard", href: "/dashboard", icon: LayoutDashboard },
  { label: "Transactions", href: "/transactions", icon: ArrowLeftRight },
  {
    label: "Security",
    href: "/security/behavior",
    icon: ShieldCheck,
    children: [
      { label: "Behavioral Profile", href: "/security/behavior", icon: Activity },
      { label: "Devices & Sessions", href: "/security/devices", icon: Fingerprint },
      { label: "Security Map", href: "/security/login-history", icon: History },
      { label: "Trusted Locations", href: "/security/locations", icon: MapPin },
      { label: "Security Events", href: "/security/events", icon: ShieldAlert },
    ],
  },
  { label: "Alerts", href: "/alerts", icon: Bell },
  { label: "Settings", href: "/settings", icon: Settings },
];

export const ADMIN_NAV: NavItem[] = [
  { label: "Overview", href: "/admin", icon: LayoutDashboard },
  { label: "Users", href: "/admin/users", icon: Users },
  { label: "Flagged Transactions", href: "/admin/transactions/flagged", icon: FlagTriangleRight },
  {
    label: "Fraud Intelligence",
    href: "/admin/fin/soc",
    icon: Network,
    children: [
      { label: "Security Operations Center", href: "/admin/fin/soc", icon: RadioTower },
      { label: "AI Recommendation Center", href: "/admin/fin/recommendations", icon: BrainCircuit },
      { label: "FIN Analytics", href: "/admin/fin/overview", icon: Gauge },
      { label: "Relationship Graph", href: "/admin/fin/graph", icon: Network },
    ],
  },
  { label: "Alerts", href: "/admin/alerts", icon: Bell },
  { label: "Analytics", href: "/admin/analytics", icon: BarChart3 },
];

export const DEV_NAV_ITEM: NavItem = {
  label: "Context Simulator",
  href: "/dev/context-simulator",
  icon: RadioTower,
};
