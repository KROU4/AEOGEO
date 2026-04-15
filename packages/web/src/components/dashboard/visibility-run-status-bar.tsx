import { Link } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import { Loader2, Play } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { ApiError } from "@/lib/api-client";
import { useLocale } from "@/hooks/use-locale";
import { formatDate } from "@/lib/format";
import { useLatestRun } from "@/hooks/use-runs";

interface VisibilityRunStatusBarProps {
  projectId: string;
}

export function VisibilityRunStatusBar({ projectId }: VisibilityRunStatusBarProps) {
  const { t } = useTranslation("visibility");
  const { locale } = useLocale();
  const latest = useLatestRun(projectId);

  const is404 =
    latest.error instanceof ApiError && latest.error.status === 404;

  if (latest.isLoading) {
    return (
      <div className="sticky bottom-0 z-20 -mx-6 border-t bg-background/95 px-6 py-3 backdrop-blur supports-[backdrop-filter]:bg-background/80">
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" />
          {t("runStatus.loading")}
        </div>
      </div>
    );
  }

  if (is404) {
    return (
      <div className="sticky bottom-0 z-20 -mx-6 border-t bg-background/95 px-6 py-3 backdrop-blur supports-[backdrop-filter]:bg-background/80">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-sm text-muted-foreground">{t("runStatus.noRuns")}</p>
          <Button size="sm" variant="secondary" asChild>
            <Link to="/projects/$projectId/runs" params={{ projectId }}>
              <Play className="mr-2 h-4 w-4" />
              {t("runStatus.openRuns")}
            </Link>
          </Button>
        </div>
      </div>
    );
  }

  if (!latest.data) return null;

  const run = latest.data;
  const active = run.status === "pending" || run.status === "running";

  return (
    <div className="sticky bottom-0 z-20 -mx-6 border-t bg-background/95 px-6 py-3 backdrop-blur supports-[backdrop-filter]:bg-background/80">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div className="min-w-0 flex-1 space-y-2">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-sm font-medium text-foreground">
              {t("runStatus.title")}
            </span>
            <Badge variant="outline" className="font-mono text-xs">
              {run.status}
            </Badge>
            <span className="text-xs text-muted-foreground">
              {t("runStatus.updated", {
                when: formatDate(run.updated_at, locale, {
                  month: "short",
                  day: "numeric",
                  hour: "2-digit",
                  minute: "2-digit",
                }),
              })}
            </span>
          </div>
          <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
            <span>
              {t("runStatus.stageEngine")}:{" "}
              <span className="text-foreground">{run.stages.engine ?? "—"}</span>
            </span>
            <span>
              {t("runStatus.stageParse")}:{" "}
              <span className="text-foreground">{run.stages.parse ?? "—"}</span>
            </span>
            <span>
              {t("runStatus.stageScore")}:{" "}
              <span className="text-foreground">{run.stages.score ?? "—"}</span>
            </span>
          </div>
          <Progress value={run.progress_pct} className="h-2 max-w-md" />
        </div>
        <Button size="sm" variant={active ? "outline" : "default"} asChild>
          <Link to="/projects/$projectId/runs" params={{ projectId }}>
            <Play className="mr-2 h-4 w-4" />
            {t("runStatus.openRuns")}
          </Link>
        </Button>
      </div>
    </div>
  );
}
