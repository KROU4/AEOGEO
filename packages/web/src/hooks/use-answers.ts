import { useQuery } from "@tanstack/react-query";
import { apiGet } from "@/lib/api-client";
import type { AnswerExplorerItem } from "@/types/answer";
import type {
  Answer,
  PaginatedResponse,
} from "@/types/api";

export interface AnswerFilters {
  runId?: string;
  engineId?: string;
  minScore?: number;
  cursor?: string;
}

function buildAnswerParams(filters: Pick<AnswerFilters, "cursor">): string {
  const params = new URLSearchParams();
  if (filters.cursor) {
    params.set("cursor", filters.cursor);
  }
  const qs = params.toString();
  return qs ? `?${qs}` : "";
}

export function useAnswers(projectId: string, filters: AnswerFilters) {
  const { runId, engineId, minScore, cursor } = filters;

  return useQuery({
    queryKey: ["answers", projectId, runId, engineId, minScore, cursor],
    enabled: !!projectId && !!runId,
    queryFn: async () => {
      const answerPage = await apiGet<PaginatedResponse<Answer>>(
        `/projects/${projectId}/runs/${runId}/answers${buildAnswerParams({ cursor })}`
      );

      let items = answerPage.items as AnswerExplorerItem[];

      if (engineId) {
        items = items.filter((answer) => answer.engine_id === engineId);
      }

      if (minScore != null) {
        items = items.filter(
          (answer) => (answer.score?.total_score ?? 0) >= minScore
        );
      }

      return {
        ...answerPage,
        items,
      };
    },
  });
}
