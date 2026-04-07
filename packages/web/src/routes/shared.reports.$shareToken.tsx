import { createFileRoute, useParams } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { usePublicReport } from "@/hooks/use-reports";
import { ReportDetailView } from "@/components/reports/report-detail";

export const Route = createFileRoute("/shared/reports/$shareToken")({
  component: SharedReportPage,
});

function SharedReportPage() {
  const { shareToken } = useParams({ from: "/shared/reports/$shareToken" });
  const { t } = useTranslation("reports");
  const { data: report, isLoading, error } = usePublicReport(shareToken);

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top,#f5fffd,transparent_40%),linear-gradient(180deg,#ffffff_0%,#f8fafc_100%)] px-4 py-8 sm:px-6">
      <div className="mx-auto max-w-6xl space-y-8">
        {isLoading ? (
          <div className="space-y-4">
            <Skeleton className="h-36 w-full" />
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
              {Array.from({ length: 4 }).map((_, index) => (
                <Skeleton key={index} className="h-28 w-full" />
              ))}
            </div>
            <Skeleton className="h-72 w-full" />
          </div>
        ) : error || !report ? (
          <div className="rounded-3xl border border-white/60 bg-white/90 px-6 py-16 text-center shadow-[0_18px_60px_rgba(15,23,42,0.08)]">
            <p className="text-lg font-semibold text-foreground">
              {t("shared.unavailableTitle")}
            </p>
            <p className="mt-2 text-sm text-muted-foreground">
              {t("shared.unavailableDescription")}
            </p>
          </div>
        ) : (
          <ReportDetailView
            report={report}
            publicBadge={
              <Badge variant="outline" className="bg-white/80">
                {t("shared.badge")}
              </Badge>
            }
          />
        )}
      </div>
    </div>
  );
}
