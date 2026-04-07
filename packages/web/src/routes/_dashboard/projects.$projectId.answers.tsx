import { useState } from "react";
import { createFileRoute, useParams } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Slider } from "@/components/ui/slider";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Search,
  ThumbsUp,
  ThumbsDown,
  ExternalLink,
  Star,
  ChevronDown,
  ChevronUp,
  Quote,
  Award,
  X,
  MessageSquare,
} from "lucide-react";
import { FeedbackButtons } from "@/components/shared/feedback-buttons";
import { useAnswers } from "@/hooks/use-answers";
import { useEngines } from "@/hooks/use-engines";
import { useQuerySets } from "@/hooks/use-queries";
import { useRuns } from "@/hooks/use-runs";
import type { AnswerExplorerItem, Mention, Citation, VisibilityScore } from "@/types/answer";

export const Route = createFileRoute(
  "/_dashboard/projects/$projectId/answers"
)({
  component: AnswerExplorerPage,
});

// -- Constants --

// -- Engine Badge --

function EngineBadge({ engine }: { engine: string }) {
  const { t } = useTranslation("answers");

  const colors: Record<string, string> = {
    chatgpt:
      "bg-green-50 text-green-700 border-green-200 dark:bg-green-950 dark:text-green-300 dark:border-green-800",
    gemini:
      "bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950 dark:text-blue-300 dark:border-blue-800",
    perplexity:
      "bg-cyan-50 text-cyan-700 border-cyan-200 dark:bg-cyan-950 dark:text-cyan-300 dark:border-cyan-800",
    claude:
      "bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950 dark:text-amber-300 dark:border-amber-800",
    copilot:
      "bg-purple-50 text-purple-700 border-purple-200 dark:bg-purple-950 dark:text-purple-300 dark:border-purple-800",
  };

  return (
    <Badge variant="outline" className={colors[engine] ?? ""}>
      {t(`engines.${engine}`, engine)}
    </Badge>
  );
}

// -- Score Badge --

function ScoreBadge({ score }: { score?: VisibilityScore | null }) {
  const { t } = useTranslation("answers");

  if (!score) {
    return (
      <Badge variant="secondary" className="text-muted-foreground">
        {t("card.noScore")}
      </Badge>
    );
  }

  const total = score.total_score;
  let className: string;

  if (total > 7) {
    className =
      "bg-green-50 text-green-700 border-green-200 dark:bg-green-950 dark:text-green-300 dark:border-green-800";
  } else if (total > 4) {
    className =
      "bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950 dark:text-amber-300 dark:border-amber-800";
  } else {
    className =
      "bg-red-50 text-red-700 border-red-200 dark:bg-red-950 dark:text-red-300 dark:border-red-800";
  }

  return (
    <Badge variant="outline" className={className}>
      <Star className="w-3 h-3" />
      {total.toFixed(1)}
    </Badge>
  );
}

// -- Sentiment Badge --

function SentimentBadge({
  sentiment,
}: {
  sentiment: "positive" | "neutral" | "negative";
}) {
  const { t } = useTranslation("answers");

  const config = {
    positive: {
      className:
        "bg-green-50 text-green-700 border-green-200 dark:bg-green-950 dark:text-green-300 dark:border-green-800",
      icon: <ThumbsUp className="w-3 h-3" />,
    },
    neutral: {
      className:
        "bg-stone-50 text-stone-600 border-stone-200 dark:bg-stone-950 dark:text-stone-400 dark:border-stone-800",
      icon: null,
    },
    negative: {
      className:
        "bg-red-50 text-red-700 border-red-200 dark:bg-red-950 dark:text-red-300 dark:border-red-800",
      icon: <ThumbsDown className="w-3 h-3" />,
    },
  };

  const { className, icon } = config[sentiment];

  return (
    <Badge variant="outline" className={className}>
      {icon}
      {t(`sentiment.${sentiment}`)}
    </Badge>
  );
}

// -- Mention Badge --

function MentionBadge({ mention }: { mention: Mention }) {
  const { t } = useTranslation("answers");

  const sentimentColors: Record<string, string> = {
    positive:
      "bg-green-50 text-green-700 border-green-200 dark:bg-green-950 dark:text-green-300 dark:border-green-800",
    neutral:
      "bg-stone-50 text-stone-600 border-stone-200 dark:bg-stone-950 dark:text-stone-400 dark:border-stone-800",
    negative:
      "bg-red-50 text-red-700 border-red-200 dark:bg-red-950 dark:text-red-300 dark:border-red-800",
  };

  return (
    <Badge
      variant="outline"
      className={sentimentColors[mention.sentiment] ?? ""}
    >
      <span className="font-medium">{mention.entity_name}</span>
      <span className="opacity-60 ml-1 text-[10px] uppercase">
        {t(`mentions.${mention.entity_type}`)}
      </span>
      {mention.is_recommended && (
        <Award className="w-3 h-3 text-teal-600 dark:text-teal-400 ml-0.5" />
      )}
    </Badge>
  );
}

// -- Score Breakdown --

function ScoreBreakdown({ score }: { score: VisibilityScore }) {
  const { t } = useTranslation("answers");

  const items = [
    { label: t("scoreBreakdown.mention"), value: score.mention_score },
    { label: t("scoreBreakdown.sentiment"), value: score.sentiment_score },
    { label: t("scoreBreakdown.position"), value: score.position_score },
    { label: t("scoreBreakdown.accuracy"), value: score.accuracy_score },
    { label: t("scoreBreakdown.citation"), value: score.citation_score },
    {
      label: t("scoreBreakdown.recommendation"),
      value: score.recommendation_score,
    },
  ];

  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 pt-2">
      {items.map((item) => (
        <div
          key={item.label}
          className="flex items-center justify-between px-2.5 py-1.5 rounded-md bg-muted/50"
        >
          <span className="text-xs text-muted-foreground">{item.label}</span>
          <span className="text-xs font-semibold text-foreground">
            {item.value.toFixed(1)}
          </span>
        </div>
      ))}
    </div>
  );
}

// -- Citation Link --

function CitationLink({ citation }: { citation: Citation }) {
  const { t } = useTranslation("answers");

  return (
    <a
      href={citation.source_url}
      target="_blank"
      rel="noopener noreferrer"
      className="inline-flex items-center gap-1.5 text-sm hover:underline group"
    >
      <ExternalLink className="w-3 h-3 text-muted-foreground group-hover:text-primary shrink-0" />
      <span className="text-primary truncate max-w-[280px]">
        {citation.source_title || citation.source_url}
      </span>
      {citation.is_client_source && (
        <Badge
          variant="outline"
          className="bg-teal-50 text-teal-700 border-teal-200 dark:bg-teal-950 dark:text-teal-300 dark:border-teal-800 text-[10px] px-1.5 py-0"
        >
          {t("citations.clientSource")}
        </Badge>
      )}
    </a>
  );
}

// -- Answer Card --

function AnswerCard({ answer }: { answer: AnswerExplorerItem }) {
  const { t } = useTranslation("answers");
  const [expanded, setExpanded] = useState(false);

  const hasRecommendation = answer.mentions.some((m) => m.is_recommended);
  const responsePreview =
    answer.raw_response.length > 240
      ? answer.raw_response.slice(0, 240) + "..."
      : answer.raw_response;

  return (
    <Card className="transition-shadow hover:shadow-md">
      <CardContent className="pt-5 pb-4 space-y-3">
        {/* Header: Query + Engine + Score */}
        <div className="flex items-start justify-between gap-3">
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-foreground leading-snug">
              {answer.query_text}
            </p>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <EngineBadge engine={answer.engine_name} />
            <ScoreBadge score={answer.score} />
          </div>
        </div>

        {/* Response preview / expanded */}
        <div
          className="text-sm text-muted-foreground cursor-pointer select-text rounded-md bg-muted/30 px-3 py-2.5"
          onClick={() => setExpanded(!expanded)}
        >
          <p className="whitespace-pre-wrap break-words">
            {expanded ? answer.raw_response : responsePreview}
          </p>
          <button className="inline-flex items-center gap-1 text-xs text-primary mt-1.5 hover:underline">
            {expanded ? (
              <>
                <ChevronUp className="w-3 h-3" />
                {t("card.collapse")}
              </>
            ) : answer.raw_response.length > 240 ? (
              <>
                <ChevronDown className="w-3 h-3" />
                {t("card.expand")}
              </>
            ) : null}
          </button>
        </div>

        {/* Score Breakdown */}
        {answer.score && expanded && (
          <ScoreBreakdown score={answer.score} />
        )}

        {/* Mentions */}
        {answer.mentions.length > 0 && (
          <div className="space-y-1.5">
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
              {t("mentions.title")}
            </p>
            <div className="flex flex-wrap gap-1.5">
              {answer.mentions.map((mention) => (
                <MentionBadge key={mention.id} mention={mention} />
              ))}
            </div>
          </div>
        )}

        {/* Citations */}
        {answer.citations.length > 0 && (
          <div className="space-y-1.5">
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
              {t("citations.title")}
            </p>
            <div className="flex flex-col gap-1">
              {answer.citations.map((citation) => (
                <CitationLink key={citation.id} citation={citation} />
              ))}
            </div>
          </div>
        )}

        {/* Footer: Recommendation + Cited indicators + Feedback */}
        <div className="flex items-center justify-between pt-1">
          <div className="flex items-center gap-2">
            {hasRecommendation && (
              <Badge
                variant="outline"
                className="bg-teal-50 text-teal-700 border-teal-200 dark:bg-teal-950 dark:text-teal-300 dark:border-teal-800"
              >
                <Award className="w-3 h-3" />
                {t("mentions.recommended")}
              </Badge>
            )}
            {answer.citations.length > 0 && (
              <Badge
                variant="outline"
                className="bg-green-50 text-green-700 border-green-200 dark:bg-green-950 dark:text-green-300 dark:border-green-800"
              >
                <Quote className="w-3 h-3" />
                {t("citations.title")} ({answer.citations.length})
              </Badge>
            )}
            {answer.mentions.length > 0 && (
              <>
                {answer.mentions
                  .filter((m) => m.sentiment === "positive")
                  .length > 0 && (
                  <SentimentBadge sentiment="positive" />
                )}
                {answer.mentions
                  .filter((m) => m.sentiment === "negative")
                  .length > 0 && (
                  <SentimentBadge sentiment="negative" />
                )}
              </>
            )}
          </div>
          <FeedbackButtons entityType="answer" entityId={answer.id} size="sm" />
        </div>
      </CardContent>
    </Card>
  );
}

// -- Filter Bar --

function FilterBar({
  projectId,
  selectedRunId,
  onRunChange,
  selectedEngines,
  onEngineToggle,
  minScore,
  onMinScoreChange,
  onClear,
}: {
  projectId: string;
  selectedRunId: string;
  onRunChange: (runId: string) => void;
  selectedEngines: Set<string>;
  onEngineToggle: (engine: string) => void;
  minScore: number;
  onMinScoreChange: (val: number) => void;
  onClear: () => void;
}) {
  const { t } = useTranslation("answers");
  const { data: runsData } = useRuns(projectId);
  const { data: querySetsData } = useQuerySets(projectId);
  const { data: engines = [] } = useEngines();
  const runs = runsData?.items ?? [];
  const querySets = querySetsData?.items ?? [];
  const querySetNames = Object.fromEntries(
    querySets.map((querySet) => [querySet.id, querySet.name])
  );
  const engineNames = Object.fromEntries(
    engines.map((engine) => [engine.id, engine.name])
  );

  const hasFilters =
    selectedEngines.size > 0 || minScore > 0;

  return (
    <Card>
      <CardContent className="pt-5 pb-4">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end">
          {/* Run Selector */}
          <div className="space-y-1.5 min-w-[220px]">
            <Label className="text-xs">{t("filters.selectRun")}</Label>
            <Select value={selectedRunId} onValueChange={onRunChange}>
              <SelectTrigger>
                <SelectValue placeholder={t("filters.selectRunPlaceholder")} />
              </SelectTrigger>
              <SelectContent>
                {runs
                  .filter((r) => r.status === "completed" || r.status === "partial")
                  .map((run) => (
                    <SelectItem key={run.id} value={run.id}>
                      {querySetNames[run.query_set_id] ?? run.query_set_id.slice(0, 8)} --{" "}
                      {engineNames[run.engine_id] ?? run.engine_id.slice(0, 8)}
                    </SelectItem>
                  ))}
              </SelectContent>
            </Select>
          </div>

          {/* Engine Filter */}
          <div className="space-y-1.5">
            <Label className="text-xs">{t("filters.engines")}</Label>
            <div className="flex flex-wrap gap-1.5">
              {engines.map((engine) => {
                const isSelected = selectedEngines.has(engine.id);
                return (
                  <button
                    key={engine.id}
                    onClick={() => onEngineToggle(engine.id)}
                    className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-xs font-medium transition-colors cursor-pointer ${
                      isSelected
                        ? "border-primary bg-primary/10 text-primary"
                        : "border-border bg-background text-muted-foreground hover:bg-accent"
                    }`}
                  >
                    {engine.name}
                    {isSelected && <X className="w-3 h-3" />}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Min Score Slider */}
          <div className="space-y-1.5 min-w-[160px]">
            <Label className="text-xs">
              {t("filters.minScore")}: {minScore.toFixed(1)}
            </Label>
            <div className="px-1">
              <Slider
                value={[minScore]}
                onValueChange={([v]) => onMinScoreChange(v ?? 0)}
                min={0}
                max={10}
                step={0.5}
              />
            </div>
          </div>

          {/* Clear */}
          {hasFilters && (
            <Button
              variant="ghost"
              size="sm"
              onClick={onClear}
              className="shrink-0"
            >
              <X className="w-3.5 h-3.5" />
              {t("filters.clear")}
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

// -- Loading Skeleton --

function AnswersSkeleton() {
  return (
    <div className="space-y-3">
      {[1, 2, 3].map((i) => (
        <Card key={i}>
          <CardContent className="pt-5 pb-4 space-y-3">
            <div className="flex items-start justify-between gap-3">
              <Skeleton className="h-5 w-64" />
              <div className="flex gap-2">
                <Skeleton className="h-6 w-20 rounded-full" />
                <Skeleton className="h-6 w-14 rounded-full" />
              </div>
            </div>
            <Skeleton className="h-16 w-full rounded-md" />
            <div className="flex gap-2">
              <Skeleton className="h-5 w-24 rounded-full" />
              <Skeleton className="h-5 w-20 rounded-full" />
              <Skeleton className="h-5 w-28 rounded-full" />
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

// -- Empty State --

function EmptyState({ hasRun }: { hasRun: boolean }) {
  const { t } = useTranslation("answers");

  return (
    <Card>
      <CardContent className="py-16">
        <div className="text-center space-y-3">
          <div className="mx-auto w-12 h-12 rounded-full bg-muted flex items-center justify-center">
            {hasRun ? (
              <Search className="w-6 h-6 text-muted-foreground" />
            ) : (
              <MessageSquare className="w-6 h-6 text-muted-foreground" />
            )}
          </div>
          <p className="text-muted-foreground max-w-md mx-auto">
            {hasRun ? t("emptyState") : t("noRunSelected")}
          </p>
        </div>
      </CardContent>
    </Card>
  );
}

// -- Main Page --

function AnswerExplorerPage() {
  const { projectId } = useParams({
    from: "/_dashboard/projects/$projectId/answers",
  });
  const { t } = useTranslation("answers");

  // Filter state
  const [selectedRunId, setSelectedRunId] = useState("");
  const [selectedEngines, setSelectedEngines] = useState<Set<string>>(
    new Set()
  );
  const [minScore, setMinScore] = useState(0);

  function toggleEngine(engine: string) {
    setSelectedEngines((prev) => {
      const next = new Set(prev);
      if (next.has(engine)) {
        next.delete(engine);
      } else {
        next.add(engine);
      }
      return next;
    });
  }

  function clearFilters() {
    setSelectedEngines(new Set());
    setMinScore(0);
  }

  // Build engine filter: if multiple selected, we pass the first one (API limitation)
  // In a real implementation, this would be a comma-separated list or multi-param
  const engineFilter =
    selectedEngines.size === 1
      ? Array.from(selectedEngines)[0]
      : undefined;

  const { data, isLoading } = useAnswers(projectId, {
    runId: selectedRunId || undefined,
    engineId: engineFilter,
    minScore: minScore > 0 ? minScore : undefined,
  });

  const answers = data?.items ?? [];

  // Client-side filter for multi-engine (when API doesn't support multi-select)
  const filteredAnswers =
    selectedEngines.size > 1
      ? answers.filter((answer) => selectedEngines.has(answer.engine_id))
      : answers;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h2 className="text-2xl font-bold text-foreground">{t("title")}</h2>
        <p className="text-sm text-muted-foreground mt-1">{t("subtitle")}</p>
      </div>

      {/* Filter Bar */}
      <FilterBar
        projectId={projectId}
        selectedRunId={selectedRunId}
        onRunChange={setSelectedRunId}
        selectedEngines={selectedEngines}
        onEngineToggle={toggleEngine}
        minScore={minScore}
        onMinScoreChange={setMinScore}
        onClear={clearFilters}
      />

      {/* Result count */}
      {selectedRunId && !isLoading && filteredAnswers.length > 0 && (
        <p className="text-sm text-muted-foreground">
          {t("resultCount", { count: filteredAnswers.length })}
        </p>
      )}

      {/* Loading */}
      {isLoading && <AnswersSkeleton />}

      {/* Empty state */}
      {!isLoading && (!selectedRunId || filteredAnswers.length === 0) && (
        <EmptyState hasRun={!!selectedRunId} />
      )}

      {/* Answer list */}
      {!isLoading && filteredAnswers.length > 0 && (
        <div className="space-y-3">
          {filteredAnswers.map((answer) => (
            <AnswerCard key={answer.id} answer={answer} />
          ))}
        </div>
      )}

      {/* Load more */}
      {!isLoading && data?.has_more && (
        <div className="flex justify-center pt-2">
          <Button variant="outline">{t("loadMore")}</Button>
        </div>
      )}
    </div>
  );
}
