import { createFileRoute } from "@tanstack/react-router";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { TrendingUp, TrendingDown } from "lucide-react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  BarChart,
  Bar,
} from "recharts";
import { useTranslation } from "react-i18next";
import { AnalyticsEmptyState, AnalyticsProjectBar } from "@/components/dashboard/analytics-project-bar";
import { useExplorerProjectId } from "@/hooks/use-explorer-project";
import { useDashboardPeriod } from "@/hooks/use-dashboard-period";
import { useProjectDashboard } from "@/hooks/use-project-dashboard";
import { useProjectTrends } from "@/hooks/use-project-trends";
import { useProjectDashboardPlatforms } from "@/hooks/use-project-dashboard-platforms";
import { useProjectCitations } from "@/hooks/use-project-explorer";
import { useSentiment } from "@/hooks/use-visibility";
import { Skeleton } from "@/components/ui/skeleton";

export const Route = createFileRoute("/_dashboard/visibility")({
  component: VisibilityPage,
});

const TOOLTIP_STYLE = { background: "#1b1c1d", border: "none", borderRadius: 4, fontSize: 12 };

function fmtDelta(n: number): string {
  const sign = n >= 0 ? "+" : "";
  return `${sign}${n.toFixed(1)}`;
}

function VisibilityPage() {
  const { t } = useTranslation("dashboard");
  const { projectId } = useExplorerProjectId();
  const period = useDashboardPeriod();

  const dash = useProjectDashboard(projectId ?? undefined, period);
  const trends = useProjectTrends(projectId ?? undefined, 12);
  const platforms = useProjectDashboardPlatforms(projectId ?? undefined);
  const sentiment = useSentiment(projectId ?? undefined, { enabled: !!projectId });
  const recentCitations = useProjectCitations(projectId ?? undefined, { limit: 8, page: 1 });

  const trendData =
    trends.data?.labels.map((label, i) => ({
      label,
      score: trends.data?.series.visibility[i] ?? 0,
    })) ?? [];

  const barData =
    platforms.data?.platforms.map((p) => ({
      name: p.engine,
      share: p.visibility_pct,
    })) ?? [];

  const d = dash.data;

  const kpis = d
    ? [
        {
          label: t("metrics.visibilityScore"),
          value: d.overall_score.toFixed(1),
          unit: "%",
          trend: `${fmtDelta(d.overall_score_delta)} vs last period`,
          up: d.overall_score_delta >= 0,
          trendIcon: true as const,
        },
        {
          label: t("metrics.shareOfVoice"),
          value: d.share_of_voice.toFixed(1),
          unit: "%",
          trend: `${fmtDelta(d.share_of_voice_delta)} vs last period`,
          up: d.share_of_voice_delta >= 0,
          trendIcon: true as const,
        },
        {
          label: t("metrics.citations"),
          value: d.citation_rate.toFixed(1),
          unit: "%",
          trend: `${fmtDelta(d.citation_rate_delta)} vs last period`,
          up: d.citation_rate_delta >= 0,
          trendIcon: true as const,
        },
        {
          label: t("metrics.sentiment"),
          value: sentiment.data ? sentiment.data.positive_pct.toFixed(1) : "—",
          unit: "%",
          trend: t("metrics.percentPositive"),
          up: true,
          trendIcon: false as const,
        },
      ]
    : [];

  if (!projectId) {
    return (
      <div className="space-y-6">
        <AnalyticsProjectBar />
        <AnalyticsEmptyState />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <AnalyticsProjectBar />

      {dash.isLoading ? (
        <div className="grid grid-cols-4 gap-4">
          {[1, 2, 3, 4].map((i) => (
            <Skeleton key={i} className="h-28 rounded-sm" />
          ))}
        </div>
      ) : dash.error ? (
        <Card>
          <CardContent className="pt-6 text-sm text-destructive">{(dash.error as Error).message}</CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-4 gap-4">
          {kpis.map((kpi) => (
            <Card key={kpi.label}>
              <CardContent className="pt-6">
                <p className="text-xs text-muted-foreground uppercase tracking-wider mb-2">{kpi.label}</p>
                <div className="flex items-end gap-2">
                  <span className="text-3xl font-bold font-avop-mono text-foreground">{kpi.value}</span>
                  <span className="text-sm text-muted-foreground mb-1">{kpi.unit}</span>
                </div>
                <div
                  className={`flex items-center gap-1 mt-1 text-xs ${
                    kpi.trendIcon ? (kpi.up ? "text-[#4ae176]" : "text-destructive") : "text-muted-foreground"
                  }`}
                >
                  {kpi.trendIcon ? (
                    kpi.up ? (
                      <TrendingUp className="w-3 h-3" />
                    ) : (
                      <TrendingDown className="w-3 h-3" />
                    )
                  ) : null}
                  {kpi.trend}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <Card>
        <CardHeader>
          <CardTitle style={{ fontFamily: "var(--font-avop-heading)" }}>
            {t("stitch.visibility.trendTitle", { count: trends.data?.labels.length ?? 12 })}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {trends.isLoading ? (
            <Skeleton className="h-[240px] w-full" />
          ) : (
            <ResponsiveContainer width="100%" height={240}>
              <LineChart data={trendData}>
                <XAxis dataKey="label" tick={{ fontSize: 11, fill: "#737373" }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 11, fill: "#737373" }} axisLine={false} tickLine={false} domain={[0, 100]} />
                <Tooltip contentStyle={TOOLTIP_STYLE} />
                <Line
                  type="monotone"
                  dataKey="score"
                  stroke="#4cd7f6"
                  strokeWidth={2}
                  dot={false}
                  name={t("stitch.visibility.chartVisibilityPct")}
                />
              </LineChart>
            </ResponsiveContainer>
          )}
        </CardContent>
      </Card>

      <div className="grid grid-cols-2 gap-4">
        <Card>
          <CardHeader>
            <CardTitle style={{ fontFamily: "var(--font-avop-heading)" }}>{t("stitch.visibility.platformBreakdown")}</CardTitle>
          </CardHeader>
          <CardContent>
            {platforms.isLoading ? (
              <Skeleton className="h-[180px] w-full" />
            ) : barData.length === 0 ? (
              <p className="text-sm text-muted-foreground py-8 text-center">{t("noMetrics")}</p>
            ) : (
              <ResponsiveContainer width="100%" height={180}>
                <BarChart data={barData} layout="vertical" margin={{ left: 0 }}>
                  <XAxis type="number" tick={{ fontSize: 10, fill: "#737373" }} axisLine={false} tickLine={false} domain={[0, 100]} />
                  <YAxis dataKey="name" type="category" tick={{ fontSize: 11, fill: "#a3a3a3" }} axisLine={false} tickLine={false} width={100} />
                  <Tooltip
                    contentStyle={TOOLTIP_STYLE}
                    formatter={(v) => [`${v}%`, t("stitch.visibility.barTooltipVisibility")]}
                  />
                  <Bar dataKey="share" fill="#4cd7f6" radius={[0, 2, 2, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle style={{ fontFamily: "var(--font-avop-heading)" }}>{t("stitch.visibility.recentSection")}</CardTitle>
          </CardHeader>
          <CardContent>
            {recentCitations.isLoading ? (
              <Skeleton className="h-[200px] w-full" />
            ) : (
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-xs text-muted-foreground uppercase tracking-wider">
                    <th className="text-left pb-3">{t("stitch.visibility.colSource")}</th>
                    <th className="text-left pb-3">{t("stitch.visibility.colEngine")}</th>
                    <th className="text-left pb-3">{t("stitch.visibility.colPreview")}</th>
                    <th className="text-left pb-3">{t("stitch.visibility.colCites")}</th>
                  </tr>
                </thead>
                <tbody>
                  {(recentCitations.data?.citations ?? []).map((c, i) => (
                    <tr key={`${c.domain}-${i}`} className="border-t border-border/50">
                      <td className="py-2 pr-2 text-primary text-xs truncate max-w-[100px]">{c.domain}</td>
                      <td className="py-2 pr-2 text-muted-foreground text-xs">{c.engine}</td>
                      <td className="py-2 pr-2 text-foreground text-xs truncate max-w-[160px]">{c.query_preview ?? "—"}</td>
                      <td className="py-2 font-avop-mono text-xs">{c.times_cited}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
            {!recentCitations.isLoading && (recentCitations.data?.citations.length ?? 0) === 0 ? (
              <p className="text-sm text-muted-foreground py-4 text-center">{t("noMetrics")}</p>
            ) : null}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
