"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  FolderKanban,
  ListTree,
  Hash,
  Wallet,
  GitPullRequestArrow,
  Receipt,
  FileClock,
  Boxes,
  HardHat,
  Truck,
  Landmark,
  Building2,
  FileSignature,
  TrendingUp,
  Target,
  BarChart3,
  FileBarChart,
  Users,
  ShieldCheck,
  History,
  Settings,
} from "lucide-react";
import { ReactNode } from "react";

interface NavItem {
  href: string;
  label: string;
  icon: ReactNode;
}
interface NavGroup {
  title: string;
  items: NavItem[];
}

const NAV: NavGroup[] = [
  { title: "", items: [{ href: "/", label: "Dashboard", icon: <LayoutDashboard size={16} /> }] },
  {
    title: "Project Control",
    items: [
      { href: "/project-setup", label: "Project Setup", icon: <FolderKanban size={16} /> },
      { href: "/wbs", label: "WBS", icon: <ListTree size={16} /> },
      { href: "/boq", label: "BOQ", icon: <Hash size={16} /> },
      { href: "/cost-codes", label: "Cost Codes", icon: <Hash size={16} /> },
      { href: "/budget", label: "Budget", icon: <Wallet size={16} /> },
      { href: "/variations", label: "Variations", icon: <GitPullRequestArrow size={16} /> },
    ],
  },
  {
    title: "Cost",
    items: [
      { href: "/actual-cost", label: "Actual Cost", icon: <Receipt size={16} /> },
      { href: "/commitments", label: "Commitments", icon: <FileClock size={16} /> },
      { href: "/accruals", label: "Accruals", icon: <FileClock size={16} /> },
      { href: "/indirect-costs", label: "Indirect Cost", icon: <Landmark size={16} /> },
    ],
  },
  {
    title: "Resources",
    items: [
      { href: "/materials", label: "Materials & Storage", icon: <Boxes size={16} /> },
      { href: "/manpower", label: "Manpower", icon: <HardHat size={16} /> },
      { href: "/equipment", label: "Equipment", icon: <Truck size={16} /> },
      { href: "/fixed-assets", label: "Fixed Assets", icon: <Building2 size={16} /> },
    ],
  },
  {
    title: "Commercial",
    items: [{ href: "/subcontractors", label: "Subcontractors", icon: <FileSignature size={16} /> }],
  },
  {
    title: "Progress & Forecast",
    items: [
      { href: "/progress", label: "Progress", icon: <TrendingUp size={16} /> },
      { href: "/evm", label: "EVM & Forecast", icon: <Target size={16} /> },
    ],
  },
  {
    title: "Reports",
    items: [
      { href: "/reports", label: "Reports", icon: <FileBarChart size={16} /> },
      { href: "/alerts", label: "Alerts", icon: <BarChart3 size={16} /> },
    ],
  },
  {
    title: "Administration",
    items: [
      { href: "/admin/users", label: "Users & Roles", icon: <Users size={16} /> },
      { href: "/admin/audit-log", label: "Audit Trail", icon: <History size={16} /> },
      { href: "/admin/settings", label: "Settings", icon: <Settings size={16} /> },
    ],
  },
];

export function Sidebar() {
  const pathname = usePathname();
  return (
    <aside className="hidden md:flex w-64 shrink-0 flex-col border-r border-slate-800 bg-slate-950">
      <div className="flex items-center gap-2 px-4 py-4 border-b border-slate-800">
        <ShieldCheck className="text-amber-500" size={22} />
        <div>
          <div className="text-sm font-semibold text-slate-100 leading-tight">Cost Control</div>
          <div className="text-[10px] text-slate-500 leading-tight">Construction PCMS</div>
        </div>
      </div>
      <nav className="flex-1 overflow-y-auto px-2 py-3 space-y-4">
        {NAV.map((group) => (
          <div key={group.title || "root"}>
            {group.title && (
              <div className="px-2 pb-1 text-[10px] font-semibold uppercase tracking-wider text-slate-600">{group.title}</div>
            )}
            <div className="space-y-0.5">
              {group.items.map((item) => {
                const active = pathname === item.href || (item.href !== "/" && pathname.startsWith(item.href));
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={`flex items-center gap-2 rounded-md px-2 py-1.5 text-sm transition-colors ${
                      active ? "bg-amber-500/10 text-amber-400" : "text-slate-400 hover:bg-slate-900 hover:text-slate-100"
                    }`}
                  >
                    {item.icon}
                    {item.label}
                  </Link>
                );
              })}
            </div>
          </div>
        ))}
      </nav>
    </aside>
  );
}
