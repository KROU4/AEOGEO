import { useClerk } from "@clerk/react";
import { Bell, Sun, Moon, Monitor, LogOut, User, Languages } from "lucide-react";
import { Link } from "@tanstack/react-router";
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
import { useLocale } from "@/hooks/use-locale";

interface TopbarProps {
  title: string;
}

export function Topbar({ title }: TopbarProps) {
  const { signOut } = useClerk();
  const { data: user } = useCurrentUser();
  const { theme, setTheme } = useTheme();
  const { locale, setLocale } = useLocale();
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
    <header className="flex h-14 items-center justify-between border-b bg-card px-4">
      <div className="flex items-center gap-3">
        <SidebarTrigger />
        <Separator orientation="vertical" className="h-5" />
        <h1 className="text-lg font-semibold text-foreground">{title}</h1>
      </div>
      <div className="flex items-center gap-2">
        <Button
          variant="ghost"
          size="icon"
          onClick={cycleTheme}
          title={t("topbar.themeLabel", { theme })}
        >
          <ThemeIcon className="size-4 text-muted-foreground" />
          <span className="sr-only">{t("topbar.toggleTheme")}</span>
        </Button>
        <Button variant="ghost" size="icon">
          <Bell className="size-4 text-muted-foreground" />
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
            <DropdownMenuItem
              onClick={() => setLocale(locale === "en" ? "ru" : "en")}
            >
              <Languages className="size-4" />
              {t("topbar.switchLanguage")}
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
