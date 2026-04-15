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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Eye,
  TrendingUp,
  TrendingDown,
  Minus,
  FolderOpen,
  BarChart3,
  Plus,
} from "lucide-react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import { AvopPageHeader } from "@/components/avop";
import { PlatformRankingTable } from "@/components/dashboard/platform-ranking-table";
import { ShareOfVoiceChart } from "@/components/dashboard/share-of-voice-chart";
import { VisibilityRunStatusBar } from "@/components/dashboard/visibility-run-status-bar";
import { VisibilityWeeklyTrends } from "@/components/dashboard/visibility-weekly-trends";
import { useProjects } from "@/hooks/use-projects";
import { useProjectDashboardPlatforms } from "@/hooks/use-project-dashboard-platforms";
import { useProjectSov } from "@/hooks/use-project-sov";
import { useProjectTrends } from "@/hooks/use-project-trends";
import { useTrafficData } from "@/hooks/use-analytics";
import {
  useVisibilityScore,
  useSentiment,
  useCitationRate,
  useScoreSummary,
  useScoresByEngine,
  useScoreTrends,
} from "@/hooks/use-visibility";
import {
  clearStoredAnalyticsProjectId,
  readStoredAnalyticsProjectId,
  resolveAnalyticsProjectId,
  writeStoredAnalyticsProjectId,
} from "@/lib/overview-project";

export const Route = createFileRoute("/_dashboard/visibility")({
  component: VisibilityPage,
});

/* ---------- small helpers ---------- */

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

function CardSkeleton() {
  return (
    <Card>
      <CardContent className="space-y-3">
        <Skeleton className="h-4 w-24" />
        <Skeleton className="h-8 w-16" />
        <Skeleton className="h-3 w-20" />
      </CardContent>
    </Card>
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

/* ---------- page ---------- */

function VisibilityPage() {
  const { t } = useTranslation("visibility");
  const [preferredProjectId, setPreferredProjectId] = useState<string | null>(() =>
    readStoredAnalyticsProjectId(),
  );

  /* projects for the selector */
  const { data: projectsData, isLoading: projectsLoading } = useProjects();
  const projects = projectsData?.items ?? [];
  const hasProjects = projects.length > 0;
  const selectedProjectId = resolveAnalyticsProjectId(projects, preferredProjectId);

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

  /* dashboard-level data */
  const visScore = useVisibilityScore(selectedProjectId ?? undefined, {
    enabled: !!selectedProjectId,
  });
  const sentiment = useSentiment(selectedProjectId ?? undefined, {
    enabled: !!selectedProjectId,
  });
  const citation = useCitationRate(selectedProjectId ?? undefined, {
    enabled: !!selectedProjectId,
  });

  /* project-scoped score data */
  const scoreSummary = useScoreSummary(selectedProjectId ?? undefined);
  const scoresByEngine = useScoresByEngine(selectedProjectId ?? undefined);
  const scoreTrends = useScoreTrends(selectedProjectId ?? undefined);
  const trafficData = useTrafficData(selectedProjectId ?? undefined);
  const projectSov = useProjectSov(selectedProjectId ?? undefined);
  const dashboardPlatforms = useProjectDashboardPlatforms(selectedProjectId ?? undefined);
  const projectTrends = useProjectTrends(selectedProjectId ?? undefined, 12);

  /* derive overall score */
  const overallScore = scoreSummary.data?.total_score ?? visScore.data?.score;
  const overallTrend = visScore.data?.trend ?? null;
  const scoreLoading =
    !projectsLoading &&
    !!selectedProjectId &&
    (scoreSummary.isLoading || visScore.isLoading);

  return (
    <div className="space-y-8">
      {/* Page header */}
      <AvopPageHeader title={t("title")} description={t("subtitle")} />

      {hasProjects && (
        <div className="flex items-center gap-3">
          <Select
            value={selectedProjectId ?? undefined}
            onValueChange={setPreferredProjectId}
          >
            <SelectTrigger className="w-[240px]">
              <SelectValue placeholder={t("selectProject")} />
            </SelectTrigger>
            <SelectContent>
              {projectsLoading && (
                <SelectItem value="__loading__" disabled>
                  ...
                </SelectItem>
              )}
              {projects.map((p) => (
                <SelectItem key={p.id} value={p.id}>
                  {p.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}

      {!projectsLoading && !hasProjects && (
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center justify-center py-16">
            <div className="w-14 h-14 rounded-full bg-muted flex items-center justify-center mb-4">
              <FolderOpen className="w-7 h-7 text-muted-foreground" />
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

      {/* Overall visibility score card */}
      {(hasProjects || projectsLoading) && (
        <Card>
          <CardContent className="py-8">
            {scoreLoading ? (
              <div className="flex items-center gap-6">
                <Skeleton className="h-20 w-20 rounded-full" />
                <div className="space-y-2">
                  <Skeleton className="h-5 w-40" />
                  <Skeleton className="h-10 w-24" />
                  <Skeleton className="h-4 w-32" />
                </div>
              </div>
            ) : overallScore != null ? (
              <div className="flex items-center gap-6">
                <div className="relative w-20 h-20">
                  <svg viewBox="0 0 36 36" className="w-20 h-20 -rotate-90">
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
                    {t("overallScore")}
                  </p>
                  <p className="text-4xl font-bold text-foreground mt-1">
                    {overallScore.toFixed(1)}
                    <span className="text-base font-normal text-muted-foreground">
                      {t("outOf10")}
                    </span>
                  </p>
                  {overallTrend != null && (
                    <div className="flex items-center gap-2 mt-1">
                      <TrendIndicator value={overallTrend} />
                      <span className="text-xs text-muted-foreground">
                        {t("trend")}
                      </span>
                    </div>
                  )}
                </div>
              </div>
            ) : (
              <EmptyState
                icon={Eye}
                title={t("noData")}
                description={t("noDataHint")}
              />
            )}
          </CardContent>
        </Card>
      )}

      {(hasProjects || projectsLoading) && selectedProjectId && (
        <ShareOfVoiceChart
          data={projectSov.data}
          isLoading={projectSov.isLoading}
        />
      )}

      {(hasProjects || projectsLoading) && selectedProjectId && (
        <PlatformRankingTable
          data={dashboardPlatforms.data}
          isLoading={dashboardPlatforms.isLoading}
        />
      )}

      {(hasProjects || projectsLoading) && selectedProjectId && (
        <VisibilityWeeklyTrends
          data={projectTrends.data}
          isLoading={projectTrends.isLoading}
        />
      )}

      {/* Trend chart */}
      {(hasProjects || projectsLoading) && (
        <Card>
          <CardHeader>
            <CardTitle>{t("chart.title")}</CardTitle>
            <CardDescription>{t("chart.subtitle")}</CardDescription>
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
                    name={t("chart.score")}
                    stroke="var(--color-teal-500, #14b8a6)"
                    strokeWidth={2}
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
                    {t("chart.noTrendData")}
                  </p>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Traffic vs. Visibility correlation */}
      {hasProjects &&
        trafficData.data &&
        trafficData.data.daily.length > 0 &&
        scoreTrends.data &&
        scoreTrends.data.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle>{t("trafficCorrelation.title")}</CardTitle>
              <CardDescription>
                {t("trafficCorrelation.subtitle")}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={320}>
                <LineChart
                  data={trafficData.data.daily.map((td) => {
                    const matchingScore = scoreTrends.data?.find(
                      (s) => s.date === td.date,
                    );
                    return {
                      date: td.date,
                      sessions: td.sessions,
                      score: matchingScore?.total_score ?? null,
                    };
                  })}
                >
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
                    yAxisId="sessions"
                    tick={{ fontSize: 11 }}
                    className="fill-muted-foreground"
                  />
                  <YAxis
                    yAxisId="score"
                    orientation="right"
                    domain={[0, 10]}
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
                    yAxisId="sessions"
                    type="monotone"
                    dataKey="sessions"
                    name={t("trafficCorrelation.sessions")}
                    stroke="var(--color-blue-500, #3b82f6)"
                    strokeWidth={2}
                    dot={false}
                  />
                  <Line
                    yAxisId="score"
                    type="monotone"
                    dataKey="score"
                    name={t("trafficCorrelation.score")}
                    stroke="var(--color-teal-500, #14b8a6)"
                    strokeWidth={2}
                    dot={{ r: 3 }}
                    connectNulls
                  />
                </LineChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        )}

      {/* Engine breakdown */}
      {(hasProjects || projectsLoading) && (
      <div>
        <h3 className="text-lg font-semibold text-foreground mb-1">
          {t("engineBreakdown")}
        </h3>
        <p className="text-sm text-muted-foreground mb-4">
          {t("engineBreakdownHint")}
        </p>

        {scoresByEngine.isLoading && selectedProjectId ? (
          <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-5 gap-4">
            {Array.from({ length: 5 }).map((_, i) => (
              <CardSkeleton key={i} />
            ))}
          </div>
        ) : scoresByEngine.data && scoresByEngine.data.length > 0 ? (
          <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-5 gap-4">
            {scoresByEngine.data.map((engine) => {
              const color = engineColor(engine.engine);
              return (
                <Card key={engine.engine_id}>
                  <CardContent>
                    <div className="flex items-center gap-2 mb-3">
                      <div
                        className={`w-8 h-8 rounded-full ${color.bg} flex items-center justify-center`}
                      >
                        <span className={`text-xs font-bold ${color.text}`}>
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
                        {t("outOf10")}
                      </span>
                    </p>

                    {/* sub-score mini breakdown */}
                    <div className="mt-3 space-y-1">
                      <ScoreBar
                        label={t("scores.mention")}
                        value={engine.mention_score}
                      />
                      <ScoreBar
                        label={t("scores.sentiment")}
                        value={engine.sentiment_score}
                      />
                      <ScoreBar
                        label={t("scores.citation")}
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
            icon={FolderOpen}
            title={t("noData")}
            description={t("noDataHint")}
          />
        )}
      </div>
      )}

      {/* Sentiment breakdown */}
      {(hasProjects || projectsLoading) && (
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle>{t("sentimentBreakdown")}</CardTitle>
            <CardDescription>{t("sentimentHint")}</CardDescription>
          </CardHeader>
          <CardContent>
            {sentiment.isLoading ? (
              <div className="space-y-3">
                <Skeleton className="h-6 w-full" />
                <Skeleton className="h-6 w-full" />
                <Skeleton className="h-6 w-full" />
              </div>
            ) : sentiment.data ? (
              <SentimentBars data={sentiment.data} />
            ) : (
              <EmptyState
                icon={TrendingUp}
                title={t("noData")}
                description={t("noDataHint")}
              />
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>{t("citationRate")}</CardTitle>
            <CardDescription>{t("citationRateHint")}</CardDescription>
          </CardHeader>
          <CardContent>
            {citation.isLoading ? (
              <div className="space-y-3">
                <Skeleton className="h-10 w-20" />
                <Skeleton className="h-4 w-32" />
              </div>
            ) : citation.data ? (
              <div>
                <p className="text-4xl font-bold text-foreground">
                  {citation.data.rate.toFixed(1)}
                  <span className="text-base font-normal text-muted-foreground">
                    %
                  </span>
                </p>
                <p className="text-sm text-muted-foreground mt-2">
                  {t("totalCitations")}: {citation.data.total_citations}
                </p>
                <div className="mt-4 h-3 w-full rounded-full bg-muted overflow-hidden">
                  <div
                    className="h-full rounded-full bg-teal-500 transition-all"
                    style={{ width: `${Math.min(citation.data.rate, 100)}%` }}
                  />
                </div>
              </div>
            ) : (
              <EmptyState
                icon={BarChart3}
                title={t("noData")}
                description={t("noDataHint")}
              />
            )}
          </CardContent>
        </Card>
      </div>
      )}

      {selectedProjectId && <VisibilityRunStatusBar projectId={selectedProjectId} />}
    </div>
  );
}

/* ---------- sub-components ---------- */

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

function SentimentBars({
  data,
}: {
  data: { positive: number; neutral: number; negative: number };
}) {
  const { t } = useTranslation("visibility");
  const total = data.positive + data.neutral + data.negative || 1;
  const bars = [
    {
      label: t("positive"),
      value: data.positive,
      pct: (data.positive / total) * 100,
      color: "bg-green-500",
    },
    {
      label: t("neutral"),
      value: data.neutral,
      pct: (data.neutral / total) * 100,
      color: "bg-amber-400",
    },
    {
      label: t("negative"),
      value: data.negative,
      pct: (data.negative / total) * 100,
      color: "bg-red-500",
    },
  ];

  return (
    <div className="space-y-4">
      {bars.map((bar) => (
        <div key={bar.label}>
          <div className="flex items-center justify-between mb-1">
            <span className="text-sm text-foreground">{bar.label}</span>
            <span className="text-sm font-medium text-foreground">
              {bar.pct.toFixed(0)}%
            </span>
          </div>
          <div className="h-2.5 w-full rounded-full bg-muted overflow-hidden">
            <div
              className={`h-full rounded-full ${bar.color} transition-all`}
              style={{ width: `${bar.pct}%` }}
            />
          </div>
        </div>
      ))}
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
