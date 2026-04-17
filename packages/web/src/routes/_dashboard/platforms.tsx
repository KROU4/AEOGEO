import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { AnalyticsEmptyState, AnalyticsProjectBar } from "@/components/dashboard/analytics-project-bar";
import { useExplorerProjectId } from "@/hooks/use-explorer-project";
import { useProjectDashboardPlatforms } from "@/hooks/use-project-dashboard-platforms";
import { usePlatformQueries } from "@/hooks/use-project-explorer";
import { useEngines } from "@/hooks/use-engines";
import type { DashboardPlatformRow } from "@/types/dashboard-platforms";
import type { Engine } from "@/types/engine";
import { Skeleton } from "@/components/ui/skeleton";
import { useTranslation } from "react-i18next";

function resolveEngineSlug(engineLabel: string, engines: Engine[]): string | undefined {
  const trimmed = engineLabel.trim().toLowerCase();
  const exact = engines.find((e) => e.name.trim().toLowerCase() === trimmed);
  if (exact) return exact.slug;
  return engines.find((e) => trimmed.includes(e.slug))?.slug;
}

export const Route = createFileRoute("/_dashboard/platforms")({
  component: PlatformsPage,
});

const COLORS = ["#4cd7f6", "#4ae176", "#a78bfa", "#fb923c", "#f472b6"];

function PlatformsPage() {
  const { t } = useTranslation("dashboard");
  const { projectId } = useExplorerProjectId();
  const platformsQ = useProjectDashboardPlatforms(projectId ?? undefined);
  const enginesQ = useEngines();
  const [selectedName, setSelectedName] = useState<string | null>(null);

  const rows = platformsQ.data?.platforms ?? [];
  const selectedRow = rows.find((r) => r.engine === selectedName) ?? null;
  const selectedSlug = selectedRow
    ? resolveEngineSlug(selectedRow.engine, enginesQ.data ?? [])
    : undefined;

  const queriesQ = usePlatformQueries(projectId, selectedSlug ?? "");

  return (
    <div className="space-y-6">
      <AnalyticsProjectBar />

      {!projectId ? <AnalyticsEmptyState /> : null}

      {projectId && platformsQ.isLoading ? (
        <div className="grid grid-cols-2 gap-4">
          <Skeleton className="h-40 w-full" />
          <Skeleton className="h-40 w-full" />
        </div>
      ) : null}

      {projectId && !platformsQ.isLoading && rows.length === 0 ? (
        <p className="text-sm text-muted-foreground">{t("stitch.platforms.emptyEngines")}</p>
      ) : null}

      <div className="grid grid-cols-2 gap-4">
        {rows.map((p, idx) => (
          <PlatformCard
            key={p.engine}
            row={p}
            color={COLORS[idx % COLORS.length]}
            active={selectedName === p.engine}
            onSelect={() => setSelectedName(selectedName === p.engine ? null : p.engine)}
            runLabel={t("stitch.platforms.cardSubtitle", {
              runs: p.run_count,
              rank: p.avg_rank.toFixed(1),
            })}
            clickHint={t("stitch.platforms.clickHint")}
          />
        ))}
      </div>

      {selectedRow && selectedSlug && projectId ? (
        <Card
          className="border-t-2"
          style={{
            borderTopColor: COLORS[Math.max(0, rows.findIndex((r) => r.engine === selectedRow.engine)) % COLORS.length],
          }}
        >
          <CardHeader>
            <CardTitle style={{ fontFamily: "var(--font-avop-heading)", color: COLORS[rows.indexOf(selectedRow) % COLORS.length] }}>
              {t("stitch.platforms.deepDiveTitle", { name: selectedRow.engine })}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm font-medium text-foreground mb-4">{t("stitch.platforms.topQueries")}</p>
            {queriesQ.isLoading ? (
              <Skeleton className="h-[200px] w-full" />
            ) : (
              <div className="space-y-3">
                {(queriesQ.data?.queries ?? []).map((q) => (
                  <div key={q.answer_id} className="flex flex-col gap-1 border-b border-border/40 pb-3 last:border-0">
                    <p className="text-sm text-foreground">{q.query_text}</p>
                    <p className="text-xs text-muted-foreground">
                      {t("stitch.platforms.queryMeta", {
                        rank: q.rank,
                        mention: q.brand_mentioned
                          ? t("stitch.platforms.mentioned")
                          : t("stitch.platforms.notMentioned"),
                        citations: q.citation_count,
                      })}
                    </p>
                  </div>
                ))}
                {(queriesQ.data?.queries.length ?? 0) === 0 ? (
                  <p className="text-sm text-muted-foreground">{t("stitch.platforms.noQueriesYet")}</p>
                ) : null}
              </div>
            )}

            <div className="mt-8 grid grid-cols-2 gap-8">
              <div>
                <p className="text-sm font-medium text-foreground mb-4">{t("stitch.platforms.visibilitySov")}</p>
                <div className="space-y-3">
                  <MetricBar
                    label={t("stitch.platforms.metricVisibility")}
                    value={selectedRow.visibility_pct}
                    color={COLORS[rows.indexOf(selectedRow) % COLORS.length]}
                  />
                  <MetricBar label={t("stitch.platforms.metricSov")} value={selectedRow.sov_pct} color="#4ae176" />
                  <MetricBar
                    label={t("stitch.platforms.metricRank")}
                    value={selectedRow.avg_rank}
                    max={10}
                    color="#a78bfa"
                  />
                </div>
              </div>
              <div>
                <p className="text-sm font-medium text-foreground mb-4">{t("stitch.platforms.runs")}</p>
                <p className="text-2xl font-avop-mono text-foreground">{selectedRow.run_count}</p>
                <p className="text-xs text-muted-foreground mt-1">{t("stitch.platforms.runsHint")}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}

function MetricBar({
  label,
  value,
  color,
  max = 100,
}: {
  label: string;
  value: number;
  color: string;
  max?: number;
}) {
  const pct = Math.min(100, Math.max(0, (value / max) * 100));
  return (
    <div>
      <div className="flex justify-between text-xs mb-1">
        <span className="text-muted-foreground">{label}</span>
        <span className="font-avop-mono text-foreground">{value.toFixed(1)}</span>
      </div>
      <div className="h-1.5 w-full rounded-full bg-muted overflow-hidden">
        <div className="h-full rounded-full transition-all" style={{ width: `${pct}%`, background: color }} />
      </div>
    </div>
  );
}

function PlatformCard({
  row,
  color,
  active,
  onSelect,
  runLabel,
  clickHint,
}: {
  row: DashboardPlatformRow;
  color: string;
  active: boolean;
  onSelect: () => void;
  runLabel: string;
  clickHint: string;
}) {
  return (
    <Card
      className={`cursor-pointer transition-all hover:bg-accent/10 ${active ? "ring-1 ring-primary" : ""}`}
      onClick={onSelect}
    >
      <CardContent className="pt-6">
        <div className="flex items-start justify-between mb-4">
          <div>
            <h3 className="font-semibold text-foreground" style={{ fontFamily: "var(--font-avop-heading)" }}>
              {row.engine}
            </h3>
            <p className="text-xs text-muted-foreground mt-0.5">{runLabel}</p>
          </div>
          <span className="text-3xl font-bold font-avop-mono" style={{ color }}>
            {row.visibility_pct.toFixed(0)}
          </span>
        </div>
        <p className="text-xs text-muted-foreground mt-2">{clickHint}</p>
      </CardContent>
    </Card>
  );
}
