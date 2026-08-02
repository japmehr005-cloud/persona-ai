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
  /** i18n key under `nav.*` for customer nav, or plain label for admin. */
  labelKey: string;
  /** Fallback English label (admin / when i18n unavailable). */
  label: string;
  href: string;
  icon: LucideIcon;
  children?: { labelKey: string; label: string; href: string; icon: LucideIcon }[];
}

export const CUSTOMER_NAV: NavItem[] = [
  { labelKey: "dashboard", label: "Dashboard", href: "/dashboard", icon: LayoutDashboard },
  { labelKey: "assistant", label: "Persona AI", href: "/assistant", icon: BrainCircuit },
  { labelKey: "transactions", label: "Transactions", href: "/transactions", icon: ArrowLeftRight },
  {
    labelKey: "security",
    label: "Security",
    href: "/security/behavior",
    icon: ShieldCheck,
    children: [
      { labelKey: "behavior", label: "Behavioral Profile", href: "/security/behavior", icon: Activity },
      { labelKey: "devices", label: "Devices & Sessions", href: "/security/devices", icon: Fingerprint },
      { labelKey: "securityMap", label: "Security Map", href: "/security/login-history", icon: History },
      { labelKey: "locations", label: "Trusted Locations", href: "/security/locations", icon: MapPin },
      { labelKey: "events", label: "Security Events", href: "/security/events", icon: ShieldAlert },
    ],
  },
  { labelKey: "alerts", label: "Alerts", href: "/alerts", icon: Bell },
  { labelKey: "settings", label: "Settings", href: "/settings", icon: Settings },
];

export const ADMIN_NAV: NavItem[] = [
  { labelKey: "overview", label: "Overview", href: "/admin", icon: LayoutDashboard },
  { labelKey: "users", label: "Users", href: "/admin/users", icon: Users },
  {
    labelKey: "flagged",
    label: "Flagged Transactions",
    href: "/admin/transactions/flagged",
    icon: FlagTriangleRight,
  },
  {
    labelKey: "fin",
    label: "Fraud Intelligence",
    href: "/admin/fin/soc",
    icon: Network,
    children: [
      {
        labelKey: "soc",
        label: "Security Operations Center",
        href: "/admin/fin/soc",
        icon: RadioTower,
      },
      {
        labelKey: "recommendations",
        label: "AI Recommendation Center",
        href: "/admin/fin/recommendations",
        icon: BrainCircuit,
      },
      { labelKey: "finAnalytics", label: "FIN Analytics", href: "/admin/fin/overview", icon: Gauge },
      { labelKey: "graph", label: "Relationship Graph", href: "/admin/fin/graph", icon: Network },
    ],
  },
  { labelKey: "alerts", label: "Alerts", href: "/admin/alerts", icon: Bell },
  { labelKey: "analytics", label: "Analytics", href: "/admin/analytics", icon: BarChart3 },
];

export const DEV_NAV_ITEM: NavItem = {
  labelKey: "contextSimulator",
  label: "Context Simulator",
  href: "/dev/context-simulator",
  icon: RadioTower,
};
