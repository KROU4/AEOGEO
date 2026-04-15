import { useEffect, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Eye,
  SmilePlus,
  TrendingUp,
  TrendingDown,
  Minus,
  Play,
  PenTool,
  FileText,
  FolderOpen,
  Clock,
  Plus,
  Rocket,
  BarChart3,
} from "lucide-react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  BarChart,
  Bar,
} from "recharts";
import { AvopPageHeader } from "@/components/avop";
import { OverviewAssistantInsight } from "@/components/dashboard/overview-assistant-insight";
import { OverviewPeriodKpis } from "@/components/dashboard/overview-period-kpis";
import { OverviewWindowSparklines } from "@/components/dashboard/overview-window-sparklines";
import { useCurrentUser } from "@/hooks/use-auth";
import { useDashboardPeriod } from "@/hooks/use-dashboard-period";
import { useProjectDashboard } from "@/hooks/use-project-dashboard";
import {
  useVisibilityScore,
  useSentiment,
  useRecentActivity,
  useScoreTrends,
  useScoresByEngine,
} from "@/hooks/use-visibility";
import { useProjects } from "@/hooks/use-projects";
import { useTrafficData } from "@/hooks/use-analytics";
import { useLocale } from "@/hooks/use-locale";
import { formatDate } from "@/lib/format";
import {
  clearStoredAnalyticsProjectId,
  readStoredAnalyticsProjectId,
  resolveAnalyticsProjectId,
  writeStoredAnalyticsProjectId,
} from "@/lib/overview-project";

export const Route = createFileRoute("/_dashboard/overview")({
  component: OverviewPage,
});

/* ---------- helpers ---------- */

function TrendIndicator({ value }: { value: number }) {
  if (value > 0)
    return (
      <span className="flex items-center gap-1 text-sm font-medium text-green-600">
        <TrendingUp className="w-3.5 h-3.5" />+{value.toFixed(1)}
      </span>
    );
  if (value < 0)
    return (
      <span className="flex items-center gap-1 text-sm font-medium text-red-500">
        <TrendingDown className="w-3.5 h-3.5" />
        {value.toFixed(1)}
      </span>
    );
  return (
    <span className="flex items-center gap-1 text-sm font-medium text-muted-foreground">
      <Minus className="w-3.5 h-3.5" />
      0.0
    </span>
  );
}

function ScoreBar({ label, value }: { label: string; value: number }) {
  const pct = (value / 10) * 100;
  return (
    <div className="flex items-center gap-2">
      <span className="text-[11px] text-muted-foreground w-16 truncate">
        {label}
      </span>
      <div className="flex-1 h-1.5 rounded-full bg-muted overflow-hidden">
        <div
          className="h-full rounded-full bg-teal-500 transition-all"
          style={{ width: `${pct}%` }}
        />
      </div>
      <span className="text-[11px] font-medium text-foreground w-6 text-right">
        {value.toFixed(1)}
      </span>
    </div>
  );
}

function EmptyState({
  icon: Icon,
  title,
  description,
}: {
  icon: React.ElementType;
  title: string;
  description: string;
}) {
  return (
    <div className="flex flex-col items-center justify-center py-12 text-center">
      <div className="w-12 h-12 rounded-full bg-muted flex items-center justify-center mb-4">
        <Icon className="w-6 h-6 text-muted-foreground" />
      </div>
      <p className="text-sm font-medium text-foreground">{title}</p>
      <p className="text-sm text-muted-foreground mt-1 max-w-sm">
        {description}
      </p>
    </div>
  );
}

/* ---------- engine avatar colors ---------- */

const engineColors: Record<string, { bg: string; text: string }> = {
  ChatGPT: { bg: "bg-emerald-50", text: "text-emerald-700" },
  Gemini: { bg: "bg-blue-50", text: "text-blue-700" },
  Perplexity: { bg: "bg-violet-50", text: "text-violet-700" },
  Claude: { bg: "bg-amber-50", text: "text-amber-700" },
  Copilot: { bg: "bg-sky-50", text: "text-sky-700" },
};

function engineColor(name: string) {
  return engineColors[name] ?? { bg: "bg-teal-50", text: "text-teal-700" };
}

/* ---------- activity type -> icon mapping ---------- */

const activityIconMap: Record<string, React.ElementType> = {
  run_completed: Play,
  content_published: PenTool,
  report_generated: FileText,
  project_created: FolderOpen,
};

/* ---------- page ---------- */

function OverviewPage() {
  const { t } = useTranslation("dashboard");
  const period = useDashboardPeriod();
  const { locale } = useLocale();
  const [preferredProjectId, setPreferredProjectId] = useState<string | null>(
    () => readStoredAnalyticsProjectId(),
  );

  const { data: user } = useCurrentUser();
  const { data: projectsData, isLoading: projectsLoading } = useProjects();
  const projects = projectsData?.items ?? [];
  const hasProjects = projects.length > 0;
  const selectedProjectId = resolveAnalyticsProjectId(
    projects,
    preferredProjectId,
  );

  useEffect(() => {
    if (selectedProjectId !== preferredProjectId) {
      setPreferredProjectId(selectedProjectId);
    }
  }, [preferredProjectId, selectedProjectId]);

  useEffect(() => {
    if (selectedProjectId) {
      writeStoredAnalyticsProjectId(selectedProjectId);
      return;
    }
    clearStoredAnalyticsProjectId();
  }, [selectedProjectId]);

  const visScore = useVisibilityScore(selectedProjectId ?? undefined, {
    enabled: !!selectedProjectId,
  });
  const sentiment = useSentiment(selectedProjectId ?? undefined, {
    enabled: !!selectedProjectId,
  });
  const activity = useRecentActivity(selectedProjectId ?? undefined, {
    enabled: !!selectedProjectId,
  });
  const scoreTrends = useScoreTrends(selectedProjectId ?? undefined);
  const scoresByEngine = useScoresByEngine(selectedProjectId ?? undefined);
  const trafficData = useTrafficData(selectedProjectId ?? undefined);

  const projectDashboard = useProjectDashboard(selectedProjectId ?? undefined, period);

  const metricsLoading = visScore.isLoading || sentiment.isLoading;

  /* derive positive sentiment percentage */
  const sentTotal = sentiment.data
    ? sentiment.data.positive + sentiment.data.neutral + sentiment.data.negative
    : 0;

  /* Check if we have any real metric data */
  const hasAnyMetricData =
    visScore.data?.score != null ||
    sentTotal > 0 ||
    (scoreTrends.data && scoreTrends.data.length > 0) ||
    (scoresByEngine.data && scoresByEngine.data.length > 0);

  const overallScore = visScore.data?.score ?? null;
  const overallTrend = visScore.data?.trend ?? null;

  const userName = user?.name?.split(" ")[0] ?? "";

  return (
    <div className="space-y-8">
      {/* Page header */}
      <AvopPageHeader
        title={t("title")}
        description={t("welcome", { name: userName })}
      />

      {hasProjects && (
        <div className="flex items-center gap-3">
          <span className="text-sm font-medium text-foreground">
            {t("projectSelector.label")}
          </span>
          <Select
            value={selectedProjectId ?? "__none__"}
            onValueChange={(value) => {
              if (value !== "__none__") {
                setPreferredProjectId(value);
              }
            }}
          >
            <SelectTrigger className="w-[280px]">
              <SelectValue placeholder={t("projectSelector.placeholder")} />
            </SelectTrigger>
            <SelectContent>
              {projectsLoading && (
                <SelectItem value="__loading__" disabled>
                  ...
                </SelectItem>
              )}
              {projects.map((project) => (
                <SelectItem key={project.id} value={project.id}>
                  {project.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}

      {selectedProjectId && (
        <div className="space-y-4">
          <OverviewAssistantInsight projectId={selectedProjectId} />
          <OverviewPeriodKpis
            data={projectDashboard.data}
            isLoading={projectDashboard.isLoading}
          />
          <OverviewWindowSparklines
            data={projectDashboard.data}
            isLoading={projectDashboard.isLoading}
          />
        </div>
      )}

      {/* Welcome empty state when no projects exist */}
      {!projectsLoading && !hasProjects && (
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center justify-center py-16">
            <div className="w-14 h-14 rounded-full bg-teal-50 flex items-center justify-center mb-4">
              <Rocket className="w-7 h-7 text-teal-600" />
            </div>
            <h3 className="text-lg font-semibold text-foreground mb-1">
              {t("noProject")}
            </h3>
            <p className="text-sm text-muted-foreground mb-6 text-center max-w-md">
              {t("noProjectHint")}
            </p>
            <Link to="/new-project" search={{ step: 1 }}>
              <Button>
                <Plus className="w-4 h-4" />
                {t("createProject")}
              </Button>
            </Link>
          </CardContent>
        </Card>
      )}

      {/* Hero metric cards */}
      {(hasProjects || projectsLoading || metricsLoading) && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Visibility Score hero card */}
          <Card className="bg-gradient-to-br from-teal-50/50 to-transparent dark:from-teal-950/20 dark:to-transparent">
            <CardContent className="py-8">
              {visScore.isLoading ? (
                <div className="flex items-center gap-6">
                  <Skeleton className="h-24 w-24 rounded-full shrink-0" />
                  <div className="space-y-2">
                    <Skeleton className="h-4 w-32" />
                    <Skeleton className="h-10 w-24" />
                    <Skeleton className="h-4 w-28" />
                  </div>
                </div>
              ) : overallScore != null ? (
                <div className="flex items-center gap-6">
                  <div className="relative w-24 h-24 shrink-0">
                    <svg
                      viewBox="0 0 36 36"
                      className="w-24 h-24 -rotate-90"
                    >
                      <path
                        d="M18 2.0845
                        a 15.9155 15.9155 0 0 1 0 31.831
                        a 15.9155 15.9155 0 0 1 0 -31.831"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="3"
                        className="text-muted/30"
                      />
                      <path
                        d="M18 2.0845
                        a 15.9155 15.9155 0 0 1 0 31.831
                        a 15.9155 15.9155 0 0 1 0 -31.831"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="3"
                        strokeDasharray={`${(overallScore / 10) * 100}, 100`}
                        className="text-teal-500"
                        strokeLinecap="round"
                      />
                    </svg>
                    <span className="absolute inset-0 flex items-center justify-center text-lg font-bold text-foreground">
                      {overallScore.toFixed(1)}
                    </span>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">
                      {t("heroVisibility.title")}
                    </p>
                    <p className="text-4xl font-bold text-foreground mt-1">
                      {overallScore.toFixed(1)}
                      <span className="text-base font-normal text-muted-foreground">
                        {t("metrics.outOf10")}
                      </span>
                    </p>
                    {overallTrend != null && (
                      <div className="flex items-center gap-2 mt-1">
                        <TrendIndicator value={overallTrend} />
                        <span className="text-xs text-muted-foreground">
                          {t("heroVisibility.trend")}
                        </span>
                      </div>
                    )}
                  </div>
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center py-6 text-center">
                  <div className="w-16 h-16 rounded-full bg-muted/50 flex items-center justify-center mb-3">
                    <Eye className="w-8 h-8 text-muted-foreground" />
                  </div>
                  <p className="text-sm font-medium text-foreground">
                    {t("noMetrics")}
                  </p>
                  <p className="text-sm text-muted-foreground mt-1 max-w-xs">
                    {t("noMetricsHint")}
                  </p>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Sentiment hero card */}
          <Card className="bg-gradient-to-br from-amber-50/40 to-transparent dark:from-amber-950/10 dark:to-transparent">
            <CardContent className="py-8">
              {sentiment.isLoading ? (
                <div className="space-y-4">
                  <div className="flex items-center gap-2">
                    <Skeleton className="w-8 h-8 rounded-lg" />
                    <Skeleton className="h-5 w-36" />
                  </div>
                  <Skeleton className="h-4 w-full rounded-full" />
                  <div className="flex gap-6">
                    <Skeleton className="h-4 w-20" />
                    <Skeleton className="h-4 w-20" />
                    <Skeleton className="h-4 w-20" />
                  </div>
                </div>
              ) : sentiment.data && sentTotal > 0 ? (
                <div>
                  <div className="flex items-center gap-2 mb-5">
                    <div className="w-8 h-8 rounded-lg bg-amber-100 dark:bg-amber-900/30 flex items-center justify-center">
                      <SmilePlus className="w-4.5 h-4.5 text-amber-600" />
                    </div>
                    <p className="text-sm font-medium text-foreground">
                      {t("heroSentiment.title")}
                    </p>
                  </div>

                  {/* Stacked horizontal bar */}
                  <div className="h-4 w-full rounded-full overflow-hidden flex">
                    {sentiment.data.positive > 0 && (
                      <div
                        className="h-full bg-green-500 first:rounded-l-full last:rounded-r-full"
                        style={{
                          width: `${(sentiment.data.positive / sentTotal) * 100}%`,
                        }}
                      />
                    )}
                    {sentiment.data.neutral > 0 && (
                      <div
                        className="h-full bg-amber-400 first:rounded-l-full last:rounded-r-full"
                        style={{
                          width: `${(sentiment.data.neutral / sentTotal) * 100}%`,
                        }}
                      />
                    )}
                    {sentiment.data.negative > 0 && (
                      <div
                        className="h-full bg-red-500 first:rounded-l-full last:rounded-r-full"
                        style={{
                          width: `${(sentiment.data.negative / sentTotal) * 100}%`,
                        }}
                      />
                    )}
                  </div>

                  {/* Legend */}
                  <div className="flex flex-wrap gap-x-6 gap-y-2 mt-4">
                    <div className="flex items-center gap-2">
                      <div className="w-2.5 h-2.5 rounded-full bg-green-500" />
                      <span className="text-sm text-muted-foreground">
                        {t("heroSentiment.positive")}
                      </span>
                      <span className="text-sm font-semibold text-foreground">
                        {((sentiment.data.positive / sentTotal) * 100).toFixed(
                          0,
                        )}
                        %
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="w-2.5 h-2.5 rounded-full bg-amber-400" />
                      <span className="text-sm text-muted-foreground">
                        {t("heroSentiment.neutral")}
                      </span>
                      <span className="text-sm font-semibold text-foreground">
                        {((sentiment.data.neutral / sentTotal) * 100).toFixed(
                          0,
                        )}
                        %
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="w-2.5 h-2.5 rounded-full bg-red-500" />
                      <span className="text-sm text-muted-foreground">
                        {t("heroSentiment.negative")}
                      </span>
                      <span className="text-sm font-semibold text-foreground">
                        {((sentiment.data.negative / sentTotal) * 100).toFixed(
                          0,
                        )}
                        %
                      </span>
                    </div>
                  </div>

                  <p className="text-xs text-muted-foreground mt-3">
                    {sentiment.data.positive + sentiment.data.neutral + sentiment.data.negative}{" "}
                    {locale === "ru" ? "упоминаний" : "mentions"}
                  </p>
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center py-6 text-center">
                  <div className="w-16 h-16 rounded-full bg-muted/50 flex items-center justify-center mb-3">
                    <SmilePlus className="w-8 h-8 text-muted-foreground" />
                  </div>
                  <p className="text-sm font-medium text-foreground">
                    {t("noMetrics")}
                  </p>
                  <p className="text-sm text-muted-foreground mt-1 max-w-xs">
                    {t("noMetricsHint")}
                  </p>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      )}

      {/* No data hint when projects exist but no metrics */}
      {hasProjects && !metricsLoading && !hasAnyMetricData && (
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center justify-center py-12">
            <div className="w-12 h-12 rounded-full bg-muted flex items-center justify-center mb-4">
              <Eye className="w-6 h-6 text-muted-foreground" />
            </div>
            <p className="text-sm font-medium text-foreground mb-1">
              {t("noMetrics")}
            </p>
            <p className="text-sm text-muted-foreground mb-4 text-center max-w-sm">
              {t("noMetricsHint")}
            </p>
            {selectedProjectId ? (
              <Link
                to="/projects/$projectId/runs"
                params={{ projectId: selectedProjectId }}
              >
                <Button variant="secondary">
                  <Play className="w-4 h-4" />
                  {t("quickActions.newRun")}
                </Button>
              </Link>
            ) : null}
          </CardContent>
        </Card>
      )}

      {/* Score trend chart */}
      {(hasProjects || projectsLoading) && (
        <Card>
          <CardHeader>
            <CardTitle>{t("scoreTrend.title")}</CardTitle>
            <CardDescription>{t("scoreTrend.subtitle")}</CardDescription>
          </CardHeader>
          <CardContent>
            {scoreTrends.isLoading && selectedProjectId ? (
              <Skeleton className="h-80 w-full rounded-lg" />
            ) : scoreTrends.data && scoreTrends.data.length >= 2 ? (
              <ResponsiveContainer width="100%" height={320}>
                <LineChart data={scoreTrends.data}>
                  <CartesianGrid
                    strokeDasharray="3 3"
                    className="stroke-border"
                  />
                  <XAxis
                    dataKey="date"
                    tick={{ fontSize: 12 }}
                    className="fill-muted-foreground"
                    tickFormatter={(v) =>
                      new Date(String(v)).toLocaleDateString(undefined, {
                        month: "short",
                        day: "numeric",
                      })
                    }
                  />
                  <YAxis
                    domain={[0, 10]}
                    tick={{ fontSize: 12 }}
                    className="fill-muted-foreground"
                  />
                  <Tooltip
                    contentStyle={{
                      borderRadius: 8,
                      border: "1px solid var(--border)",
                      backgroundColor: "var(--popover)",
                      color: "var(--popover-foreground)",
                    }}
                    labelFormatter={(v) =>
                      new Date(String(v)).toLocaleDateString(undefined, {
                        month: "long",
                        day: "numeric",
                        year: "numeric",
                      })
                    }
                  />
                  <Line
                    type="monotone"
                    dataKey="total_score"
                    name={t("scoreTrend.score")}
                    stroke="var(--color-teal-500, #14b8a6)"
                    strokeWidth={2.5}
                    dot={{ r: 4 }}
                    activeDot={{ r: 6 }}
                  />
                </LineChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-80 rounded-lg border border-dashed border-border flex items-center justify-center bg-muted/30">
                <div className="text-center">
                  <BarChart3 className="w-12 h-12 text-muted-foreground mx-auto" />
                  <p className="text-sm text-muted-foreground mt-2">
                    {t("scoreTrend.noData")}
                  </p>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Website traffic */}
      {hasProjects && (
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle>{t("traffic.title")}</CardTitle>
                <CardDescription>{t("traffic.subtitle")}</CardDescription>
              </div>
              {trafficData.data && trafficData.data.daily.length > 0 && (
                <span className="text-xs text-muted-foreground">
                  {t("traffic.last30")}
                </span>
              )}
            </div>
          </CardHeader>
          <CardContent className="space-y-6">
            {trafficData.isLoading && selectedProjectId ? (
              <Skeleton className="h-48 w-full rounded-lg" />
            ) : trafficData.data && trafficData.data.daily.length > 0 ? (
              <>
                {/* Summary cards */}
                <div className="grid grid-cols-3 gap-4">
                  <div className="rounded-lg border p-4">
                    <p className="text-xs text-muted-foreground">
                      {t("traffic.sessions")}
                    </p>
                    <p className="text-2xl font-bold text-foreground mt-1">
                      {trafficData.data.total_sessions.toLocaleString()}
                    </p>
                  </div>
                  <div className="rounded-lg border p-4">
                    <p className="text-xs text-muted-foreground">
                      {t("traffic.pageviews")}
                    </p>
                    <p className="text-2xl font-bold text-foreground mt-1">
                      {trafficData.data.total_pageviews.toLocaleString()}
                    </p>
                  </div>
                  <div className="rounded-lg border p-4">
                    <p className="text-xs text-muted-foreground">
                      {t("traffic.users")}
                    </p>
                    <p className="text-2xl font-bold text-foreground mt-1">
                      {trafficData.data.total_users.toLocaleString()}
                    </p>
                  </div>
                </div>

                {/* Sessions chart */}
                <ResponsiveContainer width="100%" height={200}>
                  <LineChart data={trafficData.data.daily}>
                    <CartesianGrid
                      strokeDasharray="3 3"
                      className="stroke-border"
                    />
                    <XAxis
                      dataKey="date"
                      tick={{ fontSize: 11 }}
                      className="fill-muted-foreground"
                      tickFormatter={(v) =>
                        new Date(String(v)).toLocaleDateString(undefined, {
                          month: "short",
                          day: "numeric",
                        })
                      }
                    />
                    <YAxis
                      tick={{ fontSize: 11 }}
                      className="fill-muted-foreground"
                    />
                    <Tooltip
                      contentStyle={{
                        borderRadius: 8,
                        border: "1px solid var(--border)",
                        backgroundColor: "var(--popover)",
                        color: "var(--popover-foreground)",
                      }}
                    />
                    <Line
                      type="monotone"
                      dataKey="sessions"
                      name={t("traffic.sessions")}
                      stroke="var(--color-teal-500, #14b8a6)"
                      strokeWidth={2}
                      dot={false}
                    />
                  </LineChart>
                </ResponsiveContainer>

                {/* Traffic sources breakdown */}
                {Object.keys(trafficData.data.traffic_sources).length > 0 && (
                  <div>
                    <p className="text-sm font-medium text-foreground mb-3">
                      {t("traffic.sources")}
                    </p>
                    <ResponsiveContainer width="100%" height={200}>
                      <BarChart
                        data={Object.entries(
                          trafficData.data.traffic_sources,
                        )
                          .sort(([, a], [, b]) => b - a)
                          .slice(0, 8)
                          .map(([name, value]) => ({ name, value }))}
                        layout="vertical"
                      >
                        <CartesianGrid
                          strokeDasharray="3 3"
                          className="stroke-border"
                        />
                        <XAxis type="number" tick={{ fontSize: 11 }} />
                        <YAxis
                          dataKey="name"
                          type="category"
                          tick={{ fontSize: 11 }}
                          width={120}
                        />
                        <Tooltip
                          contentStyle={{
                            borderRadius: 8,
                            border: "1px solid var(--border)",
                            backgroundColor: "var(--popover)",
                            color: "var(--popover-foreground)",
                          }}
                        />
                        <Bar
                          dataKey="value"
                          name={t("traffic.sessions")}
                          fill="var(--color-teal-500, #14b8a6)"
                          radius={[0, 4, 4, 0]}
                        />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                )}
              </>
            ) : (
              <EmptyState
                icon={BarChart3}
                title={t("traffic.noData")}
                description={t("traffic.noDataHint")}
              />
            )}
          </CardContent>
        </Card>
      )}

      {/* Per-engine breakdown */}
      {(hasProjects || projectsLoading) && (
        <div>
          <h3 className="text-lg font-semibold text-foreground mb-1">
            {t("engineBreakdown.title")}
          </h3>
          <p className="text-sm text-muted-foreground mb-4">
            {t("engineBreakdown.subtitle")}
          </p>

          {scoresByEngine.isLoading && selectedProjectId ? (
            <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-5 gap-4">
              {Array.from({ length: 5 }).map((_, i) => (
                <Card key={i}>
                  <CardContent className="space-y-3">
                    <Skeleton className="h-4 w-24" />
                    <Skeleton className="h-8 w-16" />
                    <Skeleton className="h-3 w-20" />
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : scoresByEngine.data && scoresByEngine.data.length > 0 ? (
            <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-5 gap-4">
              {scoresByEngine.data.map((engine) => {
                const color = engineColor(engine.engine);
                return (
                  <Card
                    key={engine.engine_id}
                    className="hover:shadow-md transition-shadow"
                  >
                    <CardContent>
                      <div className="flex items-center gap-2 mb-3">
                        <div
                          className={`w-8 h-8 rounded-full ${color.bg} flex items-center justify-center`}
                        >
                          <span
                            className={`text-xs font-bold ${color.text}`}
                          >
                            {engine.engine[0]}
                          </span>
                        </div>
                        <span className="text-sm font-medium text-foreground">
                          {engine.engine}
                        </span>
                      </div>
                      <p className="text-3xl font-bold text-foreground">
                        {engine.total_score.toFixed(1)}
                        <span className="text-sm font-normal text-muted-foreground">
                          {t("metrics.outOf10")}
                        </span>
                      </p>

                      {/* sub-score mini breakdown */}
                      <div className="mt-3 space-y-1">
                        <ScoreBar
                          label={t("engineBreakdown.scores.mention")}
                          value={engine.mention_score}
                        />
                        <ScoreBar
                          label={t("engineBreakdown.scores.sentiment")}
                          value={engine.sentiment_score}
                        />
                        <ScoreBar
                          label={t("engineBreakdown.scores.citation")}
                          value={engine.citation_score}
                        />
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          ) : (
            <EmptyState
              icon={BarChart3}
              title={t("engineBreakdown.noData")}
              description={t("noMetricsHint")}
            />
          )}
        </div>
      )}

      {/* Quick actions */}
      {hasProjects && (
        <div className="flex items-center gap-3">
          {selectedProjectId ? (
            <Link
              to="/projects/$projectId/runs"
              params={{ projectId: selectedProjectId }}
            >
              <Button variant="secondary">
                <Play className="w-4 h-4" />
                {t("quickActions.newRun")}
              </Button>
            </Link>
          ) : null}
          <Link to="/content">
            <Button variant="secondary">
              <PenTool className="w-4 h-4" />
              {t("quickActions.generateContent")}
            </Button>
          </Link>
          <Link to="/reports">
            <Button variant="secondary">
              <FileText className="w-4 h-4" />
              {t("quickActions.viewReports")}
            </Button>
          </Link>
        </div>
      )}

      {/* Recent activity */}
      <Card>
        <CardHeader>
          <CardTitle>{t("recentActivity.title")}</CardTitle>
          <CardDescription>{t("recentActivity.subtitle")}</CardDescription>
        </CardHeader>
        <CardContent>
          {activity.isLoading ? (
            <div className="space-y-4">
              {Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="flex items-start gap-4 py-4">
                  <Skeleton className="w-9 h-9 rounded-lg shrink-0" />
                  <div className="flex-1 space-y-2">
                    <Skeleton className="h-4 w-48" />
                    <Skeleton className="h-3 w-64" />
                  </div>
                  <Skeleton className="h-3 w-8 shrink-0" />
                </div>
              ))}
            </div>
          ) : activity.data && activity.data.length > 0 ? (
            <div className="space-y-0">
              {activity.data.map((item, index) => {
                const Icon = activityIconMap[item.type] ?? Clock;
                const timeAgo = formatRelativeTime(item.timestamp);
                return (
                  <div key={item.id}>
                    <div className="flex items-start gap-4 py-4">
                      <div className="w-9 h-9 rounded-lg bg-muted flex items-center justify-center shrink-0">
                        <Icon className="w-4 h-4 text-muted-foreground" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-foreground">
                          {item.description}
                        </p>
                        <p className="text-xs text-muted-foreground mt-0.5">
                          {formatDate(item.timestamp, locale)}
                        </p>
                      </div>
                      <span className="text-xs text-muted-foreground shrink-0">
                        {timeAgo}
                      </span>
                    </div>
                    {index < activity.data!.length - 1 && <Separator />}
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <div className="w-12 h-12 rounded-full bg-muted flex items-center justify-center mb-4">
                <Clock className="w-6 h-6 text-muted-foreground" />
              </div>
              <p className="text-sm font-medium text-foreground">
                {t("recentActivity.empty")}
              </p>
              <p className="text-sm text-muted-foreground mt-1 max-w-sm">
                {t("recentActivity.emptyHint")}
              </p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

/* ---------- relative time helper ---------- */

function formatRelativeTime(timestamp: string): string {
  const now = Date.now();
  const then = new Date(timestamp).getTime();
  const diff = now - then;

  const seconds = Math.floor(diff / 1000);
  if (seconds < 60) return "<1m";
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days}d`;
  const months = Math.floor(days / 30);
  return `${months}mo`;
}
