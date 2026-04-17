import { Link, useLocation } from "@tanstack/react-router";
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
import { analyticsNavItems, projectsNavItems, systemNavItems } from "@/lib/constants";

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
    <Sidebar className="!border-r-0 px-2 py-6">
      <SidebarHeader className="mb-8 px-2 pt-2">
        <Link to="/projects" className="flex flex-col gap-1">
          <span
            className="text-xl font-bold leading-tight text-sidebar-foreground dark:text-white"
            style={{ fontFamily: "var(--font-avop-display, var(--font-sans))" }}
          >
            AEOGEO
          </span>
          <span className="text-[10px] font-medium uppercase tracking-widest text-neutral-500">
            {t("brand.subtitle")}
          </span>
        </Link>
      </SidebarHeader>

      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>{t("navGroups.projects")}</SidebarGroupLabel>
          <SidebarMenu>
            {projectsNavItems.map((item) => (
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
          <SidebarGroupLabel>{t("navGroups.analytics")}</SidebarGroupLabel>
          <SidebarMenu>
            {analyticsNavItems.map((item) => (
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
          <SidebarGroupLabel>{t("navGroups.settings")}</SidebarGroupLabel>
          <SidebarMenu>
            {systemNavItems.map((item) => (
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

      <SidebarFooter className="mt-auto border-t border-sidebar-border pt-6 dark:border-white/5">
        <div className="flex items-center gap-3 px-2 py-2">
          <Avatar size="sm">
            <AvatarFallback>{initials}</AvatarFallback>
          </Avatar>
          <div className="flex min-w-0 flex-col">
            <span className="truncate text-sm font-medium text-sidebar-foreground">
              {user?.name || "User"}
            </span>
            <span className="truncate text-xs text-muted-foreground">
              {user?.email || "user@example.com"}
            </span>
          </div>
        </div>
      </SidebarFooter>
    </Sidebar>
  );
}
