import {
  LayoutDashboard,
  Eye,
  FileText,
  Settings,
  Link2,
  Trophy,
  Layers,
  MessageSquare,
  type LucideIcon,
} from "lucide-react";

export interface NavItem {
  labelKey: string;
  href: string;
  icon: LucideIcon;
}

/** Primary app navigation (legacy export) */
export const mainNavItems: NavItem[] = [
  { labelKey: "nav.overview", href: "/overview", icon: LayoutDashboard },
  { labelKey: "nav.visibility", href: "/visibility", icon: Eye },
  { labelKey: "nav.reports", href: "/reports", icon: FileText },
];

/** ANALYTICS — visibility metrics and breakdowns */
export const analyticsNavItems: NavItem[] = [
  { labelKey: "nav.overview", href: "/overview", icon: LayoutDashboard },
  { labelKey: "nav.visibility", href: "/visibility", icon: Eye },
  { labelKey: "nav.citations", href: "/citations", icon: Link2 },
  { labelKey: "nav.competitors", href: "/competitors", icon: Trophy },
  { labelKey: "nav.platforms", href: "/platforms", icon: Layers },
];

/** INTELLIGENCE — AI assistant + reports */
export const intelligenceNavItems: NavItem[] = [
  { labelKey: "nav.assistant", href: "/assistant", icon: MessageSquare },
  { labelKey: "nav.reports", href: "/reports", icon: FileText },
];

export const systemNavItems: NavItem[] = [
  { labelKey: "nav.settings", href: "/settings", icon: Settings },
];

/** @deprecated narrow slices — kept for any legacy imports */
export const monitorNavItems = analyticsNavItems;
export const analyzeNavItems: NavItem[] = [];
export const publishNavItems: NavItem[] = [];
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
