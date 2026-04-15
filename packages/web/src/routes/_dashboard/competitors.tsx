import { useMemo } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { AvopPageHeader } from "@/components/avop";
import { ExplorerProjectSelect } from "@/components/explorer/explorer-project-select";
import { useExplorerProjectId } from "@/hooks/use-explorer-project";
import {
  useCompetitorsComparison,
  useCompetitorsInsight,
} from "@/hooks/use-project-explorer";
import { useDashboardPeriod } from "@/hooks/use-dashboard-period";

export const Route = createFileRoute("/_dashboard/competitors")({
  component: CompetitorsPage,
});

function CompetitorsPage() {
  const { t } = useTranslation("explorer");
  const period = useDashboardPeriod();
  const {
    projectId,
    projects,
    isLoadingProjects,
    setPreferredProjectId,
  } = useExplorerProjectId();
  const comp = useCompetitorsComparison(projectId ?? undefined, period);
  const insight = useCompetitorsInsight(projectId ?? undefined, period);

  const brands = comp.data?.brands ?? [];
  const maxSov = useMemo(
    () => Math.max(1, ...brands.map((b) => b.overall_sov)),
    [brands],
  );
  const platformKeys = useMemo(() => {
    const keys = new Set<string>();
    for (const b of brands) {
      for (const k of Object.keys(b.by_platform)) keys.add(k);
    }
    return [...keys].sort((a, b) => a.localeCompare(b));
  }, [brands]);

  return (
    <div className="space-y-8">
      <div>
        <AvopPageHeader
          title={t("competitors.title")}
          description={t("competitors.subtitle")}
        />
      </div>

      {isLoadingProjects ? (
        <Skeleton className="h-10 w-full max-w-md" />
      ) : projects.length === 0 ? (
        <p className="text-sm text-muted-foreground">{t("emptyProjects")}</p>
      ) : (
        <ExplorerProjectSelect
          projects={projects}
          value={projectId}
          onChange={setPreferredProjectId}
        />
      )}

      <Card>
        <CardHeader>
          <CardTitle>{t("competitors.insightTitle")}</CardTitle>
          <CardDescription>{period}</CardDescription>
        </CardHeader>
        <CardContent>
          {insight.isLoading ? (
            <Skeleton className="h-20 w-full" />
          ) : insight.error ? (
            <p className="text-sm text-destructive">
              {(insight.error as Error).message}
            </p>
          ) : (
            <p className="text-sm leading-relaxed text-foreground">
              {insight.data?.insight ?? "—"}
            </p>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{t("competitors.raceTitle")}</CardTitle>
          <CardDescription>{period}</CardDescription>
        </CardHeader>
        <CardContent>
          {comp.isLoading ? (
            <div className="space-y-2">
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-10 w-full" />
            </div>
          ) : comp.error ? (
            <p className="text-sm text-destructive">
              {(comp.error as Error).message}
            </p>
          ) : !projectId ? (
            <p className="text-sm text-muted-foreground">{t("emptyProjects")}</p>
          ) : (
            <div className="space-y-3">
              {brands.map((b) => (
                <div key={b.domain} className="space-y-1">
                  <div className="flex items-center justify-between gap-2 text-sm">
                    <span className="min-w-0 truncate font-medium">
                      {b.domain}
                      {b.is_client ? (
                        <span className="ml-1 text-muted-foreground">
                          {t("competitors.you")}
                        </span>
                      ) : null}
                    </span>
                    <span className="shrink-0 tabular-nums text-muted-foreground">
                      {b.overall_sov.toFixed(1)}%
                    </span>
                  </div>
                  <div className="h-2.5 w-full overflow-hidden rounded-full bg-muted">
                    <div
                      className="h-full rounded-full bg-primary/80 transition-[width]"
                      style={{
                        width: `${Math.min(100, (b.overall_sov / maxSov) * 100)}%`,
                      }}
                    />
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{t("competitors.matrixTitle")}</CardTitle>
          <CardDescription>{t("competitors.matrixSubtitle")}</CardDescription>
        </CardHeader>
        <CardContent className="overflow-x-auto">
          {comp.isLoading ? (
            <div className="space-y-2">
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-10 w-full" />
            </div>
          ) : comp.error ? (
            <p className="text-sm text-destructive">
              {(comp.error as Error).message}
            </p>
          ) : !projectId ? (
            <p className="text-sm text-muted-foreground">{t("emptyProjects")}</p>
          ) : platformKeys.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              {t("competitors.matrixEmpty")}
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="sticky left-0 z-10 min-w-[140px] bg-card">
                    Domain
                  </TableHead>
                  {platformKeys.map((pk) => (
                    <TableHead
                      key={pk}
                      className="whitespace-nowrap text-right text-xs font-medium uppercase tracking-wide"
                    >
                      {pk}
                    </TableHead>
                  ))}
                </TableRow>
              </TableHeader>
              <TableBody>
                {brands.map((b) => (
                  <TableRow
                    key={b.domain}
                    className={b.is_client ? "bg-primary/5" : undefined}
                  >
                    <TableCell className="sticky left-0 z-10 bg-card font-medium">
                      {b.domain}
                      {b.is_client ? (
                        <span className="ml-1 text-muted-foreground">
                          {t("competitors.you")}
                        </span>
                      ) : null}
                    </TableCell>
                    {platformKeys.map((pk) => {
                      const cell = b.by_platform[pk];
                      return (
                        <TableCell key={pk} className="text-right tabular-nums">
                          {cell ? (
                            <>
                              {cell.sov.toFixed(1)}
                              <span className="text-muted-foreground"> · </span>
                              <span className="text-muted-foreground">
                                #{cell.rank}
                              </span>
                            </>
                          ) : (
                            <span className="text-muted-foreground">—</span>
                          )}
                        </TableCell>
                      );
                    })}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
