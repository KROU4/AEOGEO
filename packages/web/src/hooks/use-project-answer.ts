import { useQuery } from "@tanstack/react-query";
import { apiGet } from "@/lib/api-client";

export interface BrandMentionSpan {
  brand: string;
  start: number;
  end: number;
}

export interface ProjectAnswerDetail {
  answer_id: string;
  engine: string;
  query_text: string;
  raw_text: string;
  brand_mentions: BrandMentionSpan[];
}

export function useProjectAnswerDetail(
  projectId: string | undefined,
  answerId: string | null,
) {
  return useQuery({
    queryKey: ["project-answer", projectId, answerId],
    queryFn: () =>
      apiGet<ProjectAnswerDetail>(
        `/projects/${projectId}/answers/${answerId}`,
      ),
    enabled: !!projectId && !!answerId,
  });
}
