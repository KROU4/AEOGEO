import {
  FolderOpen,
  Settings,
  Eye,
  Quote,
  type LucideIcon,
} from "lucide-react";

export interface NavItem {
  labelKey: string;
  href: string;
  icon: LucideIcon;
}

export const projectsNavItems: NavItem[] = [
  { labelKey: "nav.projects", href: "/projects", icon: FolderOpen },
];

export const analyticsNavItems: NavItem[] = [
  { labelKey: "nav.visibility", href: "/visibility", icon: Eye },
  { labelKey: "nav.citations", href: "/citations", icon: Quote },
];

export const systemNavItems: NavItem[] = [
  { labelKey: "nav.settings", href: "/settings", icon: Settings },
];

export const mainNavItems = projectsNavItems;
export const intelligenceNavItems: NavItem[] = [];
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
