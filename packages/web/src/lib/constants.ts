import {
  FileText,
  FolderOpen,
  Settings,
  type LucideIcon,
} from "lucide-react";

export interface NavItem {
  labelKey: string;
  href: string;
  icon: LucideIcon;
}

/** Primary app navigation (legacy export) */
export const mainNavItems: NavItem[] = [
  { labelKey: "nav.projects", href: "/projects", icon: FolderOpen },
  { labelKey: "nav.reports", href: "/reports", icon: FileText },
];

/** Workspace — project list + reports (GEO audit workflow) */
export const projectsNavItems: NavItem[] = [
  { labelKey: "nav.projects", href: "/projects", icon: FolderOpen },
  { labelKey: "nav.reports", href: "/reports", icon: FileText },
];

/** @deprecated Use projectsNavItems */
export const analyticsNavItems = projectsNavItems;

/** @deprecated Use projectsNavItems */
export const intelligenceNavItems: NavItem[] = [];

export const systemNavItems: NavItem[] = [
  { labelKey: "nav.settings", href: "/settings", icon: Settings },
];

/** @deprecated narrow slices — kept for any legacy imports */
export const monitorNavItems = projectsNavItems;
export const adminNavItems: NavItem[] = [];

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
