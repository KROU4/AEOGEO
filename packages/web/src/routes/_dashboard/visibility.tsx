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
} from "recharts";
import { useTranslation } from "react-i18next";
import { AnalyticsEmptyState, AnalyticsProjectBar } from "@/components/dashboard/analytics-project-bar";
import { CompetitorsAnalyticsSection } from "@/components/dashboard/competitors-analytics-section";
import { useExplorerProjectId } from "@/hooks/use-explorer-project";
import { useDashboardPeriod } from "@/hooks/use-dashboard-period";
import { useProjectDashboard } from "@/hooks/use-project-dashboard";
import { useProjectTrends } from "@/hooks/use-project-trends";
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
  const sentiment = useSentiment(projectId ?? undefined, { enabled: !!projectId });

  const trendData = (trends.data?.labels ?? []).map((label, i) => ({
    label,
    score: trends.data?.series.visibility[i] ?? 0,
  }));

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
        <CardContent className="min-w-0">
          {trends.isLoading ? (
            <Skeleton className="h-[240px] w-full" />
          ) : trends.isError ? (
            <p className="text-sm text-destructive py-8">
              {(trends.error as Error)?.message ?? String(trends.error)}
            </p>
          ) : (
            <div className="h-[240px] w-full min-w-0">
              <ResponsiveContainer width="100%" height="100%">
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
            </div>
          )}
        </CardContent>
      </Card>

      <section id="competitors" className="scroll-mt-8 space-y-6">
        <CompetitorsAnalyticsSection />
      </section>
    </div>
  );
}
