import { Link, useLocation } from "@tanstack/react-router";
import { Settings } from "lucide-react";
import { useTranslation } from "react-i18next";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuItem,
  SidebarMenuButton,
  SidebarFooter,
  SidebarHeader,
} from "@/components/ui/sidebar";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { useCurrentUser } from "@/hooks/use-auth";
import {
  monitorNavItems,
  publishNavItems,
  analyzeNavItems,
  adminNavItems,
  systemNavItems,
} from "@/lib/constants";

export function AppSidebar() {
  const location = useLocation();
  const { t } = useTranslation("common");
  const { data: user } = useCurrentUser();

  const initials = (user?.name || user?.email || "User")
    .split(" ")
    .map((segment) => segment[0] || "")
    .join("")
    .toUpperCase()
    .slice(0, 2);

  return (
    <Sidebar>
      <SidebarHeader className="p-4">
        <Link to="/overview" className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg bg-primary flex items-center justify-center">
            <span className="text-primary-foreground font-bold text-xs">A</span>
          </div>
          <span className="text-base font-bold text-sidebar-foreground">
            AEOGEO
          </span>
        </Link>
      </SidebarHeader>

      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>{t("navGroups.monitor")}</SidebarGroupLabel>
          <SidebarMenu>
            {monitorNavItems.map((item) => (
              <SidebarMenuItem key={item.href}>
                <SidebarMenuButton
                  asChild
                  isActive={location.pathname.startsWith(item.href)}
                  tooltip={t(item.labelKey)}
                >
                  <Link to={item.href}>
                    <item.icon />
                    <span>{t(item.labelKey)}</span>
                  </Link>
                </SidebarMenuButton>
              </SidebarMenuItem>
            ))}
          </SidebarMenu>
        </SidebarGroup>

        <SidebarGroup>
          <SidebarGroupLabel>{t("navGroups.publish")}</SidebarGroupLabel>
          <SidebarMenu>
            {publishNavItems.map((item) => (
              <SidebarMenuItem key={item.href}>
                <SidebarMenuButton
                  asChild
                  isActive={location.pathname.startsWith(item.href)}
                  tooltip={t(item.labelKey)}
                >
                  <Link to={item.href}>
                    <item.icon />
                    <span>{t(item.labelKey)}</span>
                  </Link>
                </SidebarMenuButton>
              </SidebarMenuItem>
            ))}
          </SidebarMenu>
        </SidebarGroup>

        <SidebarGroup>
          <SidebarGroupLabel>{t("navGroups.analyze")}</SidebarGroupLabel>
          <SidebarMenu>
            {analyzeNavItems.map((item) => (
              <SidebarMenuItem key={item.href}>
                <SidebarMenuButton
                  asChild
                  isActive={location.pathname.startsWith(item.href)}
                  tooltip={t(item.labelKey)}
                >
                  <Link to={item.href}>
                    <item.icon />
                    <span>{t(item.labelKey)}</span>
                  </Link>
                </SidebarMenuButton>
              </SidebarMenuItem>
            ))}
          </SidebarMenu>
        </SidebarGroup>

        <SidebarGroup>
          <SidebarGroupLabel>{t("navGroups.admin")}</SidebarGroupLabel>
          <SidebarMenu>
            {adminNavItems.map((item) => (
              <SidebarMenuItem key={item.href}>
                <SidebarMenuButton
                  asChild
                  isActive={location.pathname.startsWith(item.href)}
                  tooltip={t(item.labelKey)}
                >
                  <Link to={item.href}>
                    <item.icon />
                    <span>{t(item.labelKey)}</span>
                  </Link>
                </SidebarMenuButton>
              </SidebarMenuItem>
            ))}
          </SidebarMenu>
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter>
        <SidebarMenu>
          {systemNavItems.map((item) => (
            <SidebarMenuItem key={item.href}>
              <SidebarMenuButton
                asChild
                isActive={location.pathname.startsWith(item.href)}
                tooltip={t(item.labelKey)}
              >
                <Link to={item.href}>
                  <Settings />
                  <span>{t(item.labelKey)}</span>
                </Link>
              </SidebarMenuButton>
            </SidebarMenuItem>
          ))}
        </SidebarMenu>
        <div className="flex items-center gap-3 px-2 py-2">
          <Avatar size="sm">
            <AvatarFallback>{initials}</AvatarFallback>
          </Avatar>
          <div className="flex flex-col min-w-0">
            <span className="text-sm font-medium text-sidebar-foreground truncate">
              {user?.name || "User"}
            </span>
            <span className="text-xs text-muted-foreground truncate">
              {user?.email || "user@example.com"}
            </span>
          </div>
        </div>
      </SidebarFooter>
    </Sidebar>
  );
}
