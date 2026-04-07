import { createFileRoute, Outlet } from "@tanstack/react-router";
import { useLocale } from "@/hooks/use-locale";

export const Route = createFileRoute("/_auth")({
  component: AuthLayout,
});

function AuthLayout() {
  const { locale, setLocale } = useLocale();

  return (
    <div className="min-h-screen bg-background flex flex-col items-center justify-center p-4">
      <div className="mb-8 flex items-center justify-center gap-2">
        <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center">
          <span className="text-primary-foreground font-bold text-sm">A</span>
        </div>
        <span className="text-xl font-bold text-foreground">AEOGEO</span>
      </div>
      <div className="w-full max-w-[420px]">
        <Outlet />
      </div>
      <button
        onClick={() => setLocale(locale === "en" ? "ru" : "en")}
        className="mt-4 text-sm text-muted-foreground hover:text-foreground transition-colors"
      >
        {locale === "en" ? "Русский" : "English"}
      </button>
    </div>
  );
}
