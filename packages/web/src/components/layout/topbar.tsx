import { useClerk } from "@clerk/react";
import { Bell, Sun, Moon, Monitor, LogOut, User } from "lucide-react";
import { Link, useLocation, useNavigate, useSearch } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { Separator } from "@/components/ui/separator";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useCurrentUser } from "@/hooks/use-auth";
import { useTheme } from "@/hooks/use-theme";
import {
  DASHBOARD_PERIODS,
  type DashboardPeriod,
} from "@/lib/dashboard-search";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { LocaleSegmentToggle } from "@/components/ui/locale-segment-toggle";

interface TopbarProps {
  title: string;
}

export function Topbar({ title }: TopbarProps) {
  const { signOut } = useClerk();
  const search = useSearch({ strict: false }) as {
    period?: DashboardPeriod;
    p?: string;
  };
  const period: DashboardPeriod = search.period ?? "30d";
  const navigate = useNavigate();
  const location = useLocation();
  const { data: user } = useCurrentUser();
  const { theme, setTheme } = useTheme();
  const { t } = useTranslation("common");

  const cycleTheme = () => {
    if (theme === "light") setTheme("dark");
    else if (theme === "dark") setTheme("system");
    else setTheme("light");
  };

  const handleLogout = () => {
    void signOut({ redirectUrl: "/login" });
  };

  const initials = (user?.name || user?.email || "User")
    .split(" ")
    .map((segment) => segment[0] || "")
    .join("")
    .toUpperCase()
    .slice(0, 2);

  const ThemeIcon =
    theme === "dark" ? Moon : theme === "light" ? Sun : Monitor;

  return (
    <header className="sticky top-0 z-40 flex h-[52px] shrink-0 items-center justify-between border-b border-border bg-card px-6 dark:border-white/5 dark:bg-[#0d0e0f]/85 dark:backdrop-blur-md dark:supports-[backdrop-filter]:bg-[#0d0e0f]/75">
      <div className="flex min-w-0 flex-1 items-center gap-4">
        <SidebarTrigger />
        <Separator orientation="vertical" className="h-4 dark:bg-white/10" />
        <h1
          className="truncate text-lg font-semibold text-foreground dark:font-bold dark:uppercase dark:tracking-tight dark:text-white"
          style={{ fontFamily: "var(--font-avop-display, var(--font-sans))" }}
        >
          {title}
        </h1>
      </div>
      <div className="flex shrink-0 items-center gap-2">
        <LocaleSegmentToggle variant="app" />
        <Select
          value={period}
          onValueChange={(value: DashboardPeriod) => {
            void navigate({
              to: location.pathname,
              search: (prev) => ({
                ...prev,
                period: value,
              }),
              replace: true,
            });
          }}
        >
          <SelectTrigger
            className="h-9 w-[120px] dark:border-white/10 dark:bg-white/5 dark:text-white dark:data-[placeholder]:text-neutral-400"
            aria-label={t("topbar.periodLabel")}
          >
            <SelectValue placeholder={t("topbar.periodLabel")} />
          </SelectTrigger>
          <SelectContent>
            {DASHBOARD_PERIODS.map((p) => (
              <SelectItem key={p} value={p}>
                {t(`topbar.period.${p}`)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Button
          variant="ghost"
          size="icon"
          onClick={cycleTheme}
          title={t("topbar.themeLabel", { theme })}
          className="dark:text-neutral-400 dark:hover:bg-white/5 dark:hover:text-white"
        >
          <ThemeIcon className="size-4" />
          <span className="sr-only">{t("topbar.toggleTheme")}</span>
        </Button>
        <Button variant="ghost" size="icon" className="dark:text-neutral-400 dark:hover:bg-white/5 dark:hover:text-white">
          <Bell className="size-4" />
          <span className="sr-only">{t("topbar.notifications")}</span>
        </Button>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button className="cursor-pointer rounded-full focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2">
              <Avatar size="sm">
                <AvatarFallback>{initials}</AvatarFallback>
              </Avatar>
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-48">
            <DropdownMenuItem asChild>
              <Link to="/settings">
                <User className="size-4" />
                {t("topbar.profile")}
              </Link>
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={handleLogout} variant="destructive">
              <LogOut className="size-4" />
              {t("topbar.logOut")}
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  );
}
