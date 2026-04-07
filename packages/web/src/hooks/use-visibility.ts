import { useQuery } from "@tanstack/react-query";
import { apiGet } from "@/lib/api-client";
import type {
  VisibilityScore,
  ShareOfVoiceEntry,
  SentimentBreakdown,
  CitationRate,
  ActivityItem,
  ScoreSummary,
  EngineScore,
  ScoreTrendPoint,
} from "@/types/dashboard";
import type {
  RunSummary,
  ScoreByEngine,
  ScoreTrend,
} from "@/types/api";

type DashboardQueryOptions = {
  enabled?: boolean;
};

function withProjectParam(base: string, projectId?: string): string {
  if (!projectId) return base;
  const sep = base.includes("?") ? "&" : "?";
  return `${base}${sep}project_id=${projectId}`;
}

export function useVisibilityScore(
  projectId?: string,
  options?: DashboardQueryOptions,
) {
  return useQuery({
    queryKey: ["dashboard", "visibility-score", projectId],
    queryFn: () =>
      apiGet<VisibilityScore>(
        withProjectParam("/dashboard/visibility-score", projectId),
      ),
    enabled: options?.enabled ?? true,
  });
}

export function useShareOfVoice(
  projectId?: string,
  options?: DashboardQueryOptions,
) {
  return useQuery({
    queryKey: ["dashboard", "share-of-voice", projectId],
    queryFn: () =>
      apiGet<ShareOfVoiceEntry[]>(
        withProjectParam("/dashboard/share-of-voice", projectId),
      ),
    enabled: options?.enabled ?? true,
  });
}

export function useSentiment(
  projectId?: string,
  options?: DashboardQueryOptions,
) {
  return useQuery({
    queryKey: ["dashboard", "sentiment", projectId],
    queryFn: () =>
      apiGet<SentimentBreakdown>(
        withProjectParam("/dashboard/sentiment", projectId),
      ),
    enabled: options?.enabled ?? true,
  });
}

export function useCitationRate(
  projectId?: string,
  options?: DashboardQueryOptions,
) {
  return useQuery({
    queryKey: ["dashboard", "citation-rate", projectId],
    queryFn: () =>
      apiGet<CitationRate>(
        withProjectParam("/dashboard/citation-rate", projectId),
      ),
    enabled: options?.enabled ?? true,
  });
}

export function useRecentActivity(
  projectId?: string,
  options?: DashboardQueryOptions,
) {
  return useQuery({
    queryKey: ["dashboard", "recent-activity", projectId],
    queryFn: () =>
      apiGet<ActivityItem[]>(
        withProjectParam("/dashboard/recent-activity", projectId),
      ),
    enabled: options?.enabled ?? true,
  });
}

export function useScoreSummary(projectId?: string, runId?: string) {
  return useQuery({
    queryKey: ["scores", "summary", projectId, runId],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (runId) {
        params.set("run_id", runId);
      }
      const summary = await apiGet<RunSummary>(
        `/projects/${projectId}/scores/summary${params.toString() ? `?${params}` : ""}`
      );
      return {
        total_score: summary.avg_total,
        mention_score: summary.avg_mention,
        sentiment_score: summary.avg_sentiment,
        position_score: summary.avg_position,
        accuracy_score: summary.avg_accuracy,
        citation_score: summary.avg_citation,
        recommendation_score: summary.avg_recommendation,
        trend: null,
        run_id: summary.run_id,
      } satisfies ScoreSummary;
    },
    enabled: !!projectId,
  });
}

export function useScoresByEngine(projectId?: string) {
  return useQuery({
    queryKey: ["scores", "by-engine", projectId],
    queryFn: async () => {
      const scores = await apiGet<ScoreByEngine[]>(`/projects/${projectId}/scores/by-engine`);
      return scores.map((score) => ({
        engine_id: score.engine_id,
        engine: score.engine_name ?? score.engine_id,
        score_count: score.score_count,
        total_score: score.avg_total,
        mention_score: score.avg_mention,
        sentiment_score: score.avg_sentiment,
        position_score: score.avg_position,
        accuracy_score: score.avg_accuracy,
        citation_score: score.avg_citation,
        recommendation_score: score.avg_recommendation,
      })) satisfies EngineScore[];
    },
    enabled: !!projectId,
  });
}

export function useScoreTrends(projectId?: string) {
  return useQuery({
    queryKey: ["scores", "trends", projectId],
    queryFn: async () => {
      const trends = await apiGet<ScoreTrend[]>(`/projects/${projectId}/scores/trends`);
      return trends.map((trend) => ({
        run_id: trend.run_id,
        date: trend.created_at ?? trend.run_id,
        score_count: trend.score_count,
        total_score: trend.avg_total,
      })) satisfies ScoreTrendPoint[];
    },
    enabled: !!projectId,
  });
}
