import { createFileRoute } from "@tanstack/react-router";
import { Construction } from "lucide-react";
import { useTranslation } from "react-i18next";
import { AnalyticsEmptyState, AnalyticsProjectBar } from "@/components/dashboard/analytics-project-bar";
import { useExplorerProjectId } from "@/hooks/use-explorer-project";

export const Route = createFileRoute("/_dashboard/citations")({
  component: CitationsPage,
});

function CitationsPage() {
  const { t } = useTranslation("dashboard");
  const { projectId } = useExplorerProjectId();

  return (
    <div className="space-y-6">
      <AnalyticsProjectBar />

      {!projectId ? <AnalyticsEmptyState /> : null}

      {projectId ? (
        <div className="relative min-h-[min(420px,70vh)] overflow-hidden rounded-xl border border-border bg-muted/20">
          <div
            className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-4 bg-background/85 px-6 py-12 text-center backdrop-blur-sm"
            role="dialog"
            aria-modal="true"
            aria-labelledby="citations-dev-title"
            aria-describedby="citations-dev-desc"
          >
            <div className="flex h-14 w-14 items-center justify-center rounded-full border border-border bg-card shadow-sm">
              <Construction className="h-7 w-7 text-muted-foreground" aria-hidden />
            </div>
            <div className="max-w-md space-y-2">
              <h2 id="citations-dev-title" className="text-lg font-semibold text-foreground">
                {t("stitch.citations.inDevelopmentTitle")}
              </h2>
              <p id="citations-dev-desc" className="text-sm text-muted-foreground leading-relaxed">
                {t("stitch.citations.inDevelopmentBody")}
              </p>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
