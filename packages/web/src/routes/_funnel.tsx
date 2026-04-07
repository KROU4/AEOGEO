import { Navigate, createFileRoute, Outlet, useSearch } from "@tanstack/react-router";
import { useAuth } from "@clerk/react";
import { useLocale } from "@/hooks/use-locale";
import { FunnelProgress } from "@/components/funnel/funnel-progress";
import { useTranslation } from "react-i18next";

export const Route = createFileRoute("/_funnel")({
  component: FunnelLayout,
});

const TOTAL_STEPS = 8; // Steps 2-9 (step 1 is auth, handled externally)

function FunnelLayout() {
  const { isLoaded, isSignedIn } = useAuth();
  const { locale, setLocale } = useLocale();
  const { t } = useTranslation("funnel");
  const search = useSearch({ strict: false }) as { step?: number };
  const currentStep = Math.max(1, Math.min(search.step ?? 1, TOTAL_STEPS));

  if (!isLoaded) {
    return (
      <div className="flex min-h-screen items-center justify-center text-sm text-muted-foreground">
        Loading...
      </div>
    );
  }

  if (!isSignedIn) {
    return <Navigate to="/login" search={{ redirect_url: "/new-project" }} />;
  }

  return (
    <div className="flex min-h-screen flex-col bg-background">
      {/* Top bar */}
      <header className="flex items-center justify-between border-b px-6 py-3">
        <div className="flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary">
            <span className="text-sm font-bold text-primary-foreground">A</span>
          </div>
          <span className="text-xl font-bold text-foreground">AEOGEO</span>
        </div>
        <button
          onClick={() => setLocale(locale === "en" ? "ru" : "en")}
          className="text-sm text-muted-foreground transition-colors hover:text-foreground"
        >
          {locale === "en" ? "Русский" : "English"}
        </button>
      </header>

      {/* Progress bar */}
      <div className="border-b px-6 py-4">
        <FunnelProgress currentStep={currentStep} totalSteps={TOTAL_STEPS} />
        <p className="mt-2 text-center text-sm text-muted-foreground">
          {t("navigation.stepOf", { current: currentStep, total: TOTAL_STEPS })}
        </p>
      </div>

      {/* Step content — centered */}
      <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col items-center justify-center px-6 py-12">
        <Outlet />
      </main>
    </div>
  );
}
