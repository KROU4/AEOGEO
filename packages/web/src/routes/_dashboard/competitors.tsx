import { createFileRoute } from "@tanstack/react-router";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Lightbulb } from "lucide-react";
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer } from "recharts";
import { AnalyticsEmptyState, AnalyticsProjectBar } from "@/components/dashboard/analytics-project-bar";
import { useExplorerProjectId } from "@/hooks/use-explorer-project";
import { useDashboardPeriod } from "@/hooks/use-dashboard-period";
import { useCompetitorsComparison, useCompetitorsInsight } from "@/hooks/use-project-explorer";
import { Skeleton } from "@/components/ui/skeleton";
import { useMemo } from "react";
import { useTranslation } from "react-i18next";

export const Route = createFileRoute("/_dashboard/competitors")({
  component: CompetitorsPage,
});

const TOOLTIP_STYLE = { background: "#1b1c1d", border: "none", borderRadius: 4, fontSize: 12 };

const PALETTE = ["#4cd7f6", "#a78bfa", "#fb923c", "#6ee7b7", "#f472b6", "#94a3b8"];

function CompetitorsPage() {
  const { t } = useTranslation("dashboard");
  const { projectId } = useExplorerProjectId();
  const period = useDashboardPeriod();
  const comparison = useCompetitorsComparison(projectId ?? undefined, period);
  const insight = useCompetitorsInsight(projectId ?? undefined, period);

  const chartData = useMemo(() => {
    const brands = comparison.data?.brands ?? [];
    if (brands.length === 0) return [];
    const len = Math.max(...brands.map((b) => b.trend.length), 0);
    const rows: Record<string, string | number>[] = [];
    for (let i = 0; i < len; i += 1) {
      const row: Record<string, string | number> = { w: `W${i + 1}` };
      brands.forEach((b, bi) => {
        row[`b${bi}`] = b.trend[i] ?? 0;
      });
      rows.push(row);
    }
    return rows;
  }, [comparison.data?.brands]);

  if (!projectId) {
    return (
      <div className="space-y-6">
        <AnalyticsProjectBar />
        <AnalyticsEmptyState />
      </div>
    );
  }

  const brands = comparison.data?.brands ?? [];

  return (
    <div className="space-y-6">
      <AnalyticsProjectBar />

      <div>
        <h2 className="text-lg font-semibold text-foreground" style={{ fontFamily: "var(--font-avop-heading)" }}>
          {t("stitch.competitors.title")}
        </h2>
        <p className="text-xs text-muted-foreground mt-0.5">{t("stitch.competitors.subtitle", { period })}</p>
      </div>

      {comparison.isLoading ? (
        <Skeleton className="h-40 w-full" />
      ) : (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {brands.map((c, i) => (
            <Card key={c.domain}>
              <CardContent className="pt-6">
                <p className="text-xs text-muted-foreground mb-1 truncate" title={c.domain}>
                  {c.domain}
                  {c.is_client ? t("stitch.competitors.youSuffix") : ""}
                </p>
                <p className="text-2xl font-bold font-avop-mono" style={{ color: PALETTE[i % PALETTE.length] }}>
                  {c.overall_sov}%
                </p>
                <div className="mt-3 h-1.5 w-full rounded-full bg-muted overflow-hidden">
                  <div
                    className="h-full rounded-full"
                    style={{ width: `${Math.min(100, c.overall_sov)}%`, background: PALETTE[i % PALETTE.length] }}
                  />
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {!comparison.isLoading && brands.length === 0 ? (
        <p className="text-sm text-muted-foreground">{t("stitch.competitors.emptyCompetitors")}</p>
      ) : null}

      <Card className="border-l-2 border-l-primary">
        <CardContent className="pt-4 pb-4">
          <div className="flex items-start gap-3">
            <Lightbulb className="w-4 h-4 text-primary mt-0.5 shrink-0" />
            {insight.isLoading ? (
              <Skeleton className="h-16 w-full" />
            ) : (
              <p className="text-sm text-muted-foreground">{insight.data?.insight ?? "—"}</p>
            )}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle style={{ fontFamily: "var(--font-avop-heading)" }}>{t("stitch.competitors.sovByPlatform")}</CardTitle>
        </CardHeader>
        <CardContent className="overflow-x-auto">
          {comparison.isLoading ? (
            <Skeleton className="h-48 w-full min-w-[480px]" />
          ) : brands.length === 0 ? null : (
            <table className="w-full text-sm min-w-[600px]">
              <thead>
                <tr className="text-xs text-muted-foreground uppercase tracking-wider border-b border-border">
                  <th className="text-left pb-3 pr-2">{t("stitch.competitors.colBrand")}</th>
                  <th className="text-left pb-3 pr-2">{t("stitch.competitors.colOverallSov")}</th>
                  {Array.from(
                    new Set(brands.flatMap((b) => Object.keys(b.by_platform))),
                  ).map((pk) => (
                    <th key={pk} className="text-left pb-3 pr-2 whitespace-nowrap">
                      {pk}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {brands.map((b, ri) => (
                  <tr
                    key={b.domain}
                    className={`border-b border-border/40 ${b.is_client ? "bg-primary/5" : ""}`}
                  >
                    <td className="py-3 font-medium pr-2" style={{ color: PALETTE[ri % PALETTE.length] }}>
                      {b.domain}
                    </td>
                    <td className="py-3 font-avop-mono">{b.overall_sov}%</td>
                    {Array.from(new Set(brands.flatMap((x) => Object.keys(x.by_platform)))).map((pk) => (
                      <td key={pk} className="py-3 font-avop-mono text-xs">
                        {b.by_platform[pk] ? `${b.by_platform[pk].sov}% / r${b.by_platform[pk].rank}` : "—"}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle style={{ fontFamily: "var(--font-avop-heading)" }}>{t("stitch.competitors.weeklyTrajectory")}</CardTitle>
        </CardHeader>
        <CardContent>
          {comparison.isLoading ? (
            <Skeleton className="h-[220px] w-full" />
          ) : chartData.length === 0 ? (
            <p className="text-sm text-muted-foreground">{t("stitch.competitors.noTrend")}</p>
          ) : (
            <>
              <ResponsiveContainer width="100%" height={220}>
                <LineChart data={chartData}>
                  <XAxis dataKey="w" tick={{ fontSize: 11, fill: "#737373" }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fontSize: 11, fill: "#737373" }} axisLine={false} tickLine={false} domain={[0, 100]} />
                  <Tooltip contentStyle={TOOLTIP_STYLE} />
                  {brands.map((b, i) => (
                    <Line
                      key={b.domain}
                      type="monotone"
                      dataKey={`b${i}`}
                      name={b.domain}
                      stroke={PALETTE[i % PALETTE.length]}
                      strokeWidth={2}
                      dot={false}
                    />
                  ))}
                </LineChart>
              </ResponsiveContainer>
              <div className="flex flex-wrap items-center gap-4 mt-3 text-xs text-muted-foreground">
                {brands.map((b, i) => (
                  <span key={b.domain} className="flex items-center gap-1.5">
                    <span className="w-4 h-0.5 inline-block" style={{ background: PALETTE[i % PALETTE.length] }} />
                    {b.domain}
                  </span>
                ))}
              </div>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
