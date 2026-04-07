import {
  LayoutDashboard,
  Eye,
  FileText,
  PenTool,
  Code,
  FolderOpen,
  Settings,
  KeyRound,
  BarChart3,
  type LucideIcon,
} from "lucide-react";

export interface NavItem {
  labelKey: string;
  href: string;
  icon: LucideIcon;
}

export const mainNavItems: NavItem[] = [
  { labelKey: "nav.overview", href: "/overview", icon: LayoutDashboard },
  { labelKey: "nav.visibility", href: "/visibility", icon: Eye },
  { labelKey: "nav.reports", href: "/reports", icon: FileText },
  { labelKey: "nav.content", href: "/content", icon: PenTool },
  { labelKey: "nav.widgets", href: "/widgets", icon: Code },
  { labelKey: "nav.projects", href: "/projects", icon: FolderOpen },
];

// Grouped navigation for sidebar
export const monitorNavItems: NavItem[] = [
  { labelKey: "nav.overview", href: "/overview", icon: LayoutDashboard },
  { labelKey: "nav.projects", href: "/projects", icon: FolderOpen },
  { labelKey: "nav.visibility", href: "/visibility", icon: Eye },
];

export const publishNavItems: NavItem[] = [
  { labelKey: "nav.content", href: "/content", icon: PenTool },
  { labelKey: "nav.widgets", href: "/widgets", icon: Code },
];

export const analyzeNavItems: NavItem[] = [
  { labelKey: "nav.reports", href: "/reports", icon: FileText },
];

export const adminNavItems: NavItem[] = [
  { labelKey: "nav.adminKeys", href: "/admin/ai-keys", icon: KeyRound },
  { labelKey: "nav.adminUsage", href: "/admin/ai-usage", icon: BarChart3 },
];

export const systemNavItems: NavItem[] = [
  { labelKey: "nav.settings", href: "/settings", icon: Settings },
];

export const contentStatuses = ["draft", "review", "published", "archived"] as const;
export type ContentStatus = (typeof contentStatuses)[number];

export const contentTypes = ["faq", "blog", "comparison", "buyer_guide", "pricing_clarifier", "glossary"] as const;
export type ContentType = (typeof contentTypes)[number];

export const contentTypeLabels: Record<ContentType, string> = {
  faq: "FAQ",
  blog: "Blog",
  comparison: "Comparison",
  buyer_guide: "Buyer Guide",
  pricing_clarifier: "Pricing Clarifier",
  glossary: "Glossary",
};
