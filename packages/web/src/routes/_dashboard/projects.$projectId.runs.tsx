import { useEffect, useState, type ReactNode } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { createFileRoute, useParams } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Slider } from "@/components/ui/slider";
import { Skeleton } from "@/components/ui/skeleton";
import { Progress } from "@/components/ui/progress";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Play,
  RotateCcw,
  ArrowLeft,
  Loader2,
  Zap,
  CheckCircle2,
  XCircle,
  Clock,
  Ban,
  AlertCircle,
  ThumbsUp,
  ThumbsDown,
  Quote,
  Star,
  CalendarClock,
  Pencil,
  Pause,
  ChevronDown,
  ChevronUp,
} from "lucide-react";
import {
  useRuns,
  useCreateRun,
  useRetryRun,
  useCancelRun,
  useRunProgress,
} from "@/hooks/use-runs";
import { useQuerySets } from "@/hooks/use-queries";
import { useAnswers } from "@/hooks/use-answers";
import { useEngines } from "@/hooks/use-engines";
import {
  useSchedules,
  useCreateSchedule,
  useUpdateSchedule,
  useDeleteSchedule,
} from "@/hooks/use-schedules";
import { useLocale } from "@/hooks/use-locale";
import { formatDate } from "@/lib/format";
import { useScoreSummary } from "@/hooks/use-visibility";
import type { AnswerExplorerItem } from "@/types/answer";
import type { EngineRun, RunStatus } from "@/types/run";
import type { ScheduledRun } from "@/types/schedule";

export const Route = createFileRoute(
  "/_dashboard/projects/$projectId/runs"
)({
  component: RunsPage,
});

const DEFAULT_SCHEDULE_CRON = "0 9 * * *";

function getRunStatusConfig(status: string): {
  className: string;
  icon: ReactNode;
} {
  switch (status) {
    case "pending":
      return {
        className:
          "bg-stone-50 text-stone-700 border-stone-200 dark:bg-stone-950 dark:text-stone-300 dark:border-stone-800",
        icon: <Clock className="w-3 h-3" />,
      };
    case "running":
      return {
        className:
          "bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950 dark:text-blue-300 dark:border-blue-800",
        icon: <Loader2 className="w-3 h-3 animate-spin" />,
      };
    case "completed":
      return {
        className:
          "bg-green-50 text-green-700 border-green-200 dark:bg-green-950 dark:text-green-300 dark:border-green-800",
        icon: <CheckCircle2 className="w-3 h-3" />,
      };
    case "partial":
      return {
        className:
          "bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950 dark:text-amber-300 dark:border-amber-800",
        icon: <AlertCircle className="w-3 h-3" />,
      };
    case "failed":
      return {
        className:
          "bg-red-50 text-red-700 border-red-200 dark:bg-red-950 dark:text-red-300 dark:border-red-800",
        icon: <XCircle className="w-3 h-3" />,
      };
    case "cancelled":
      return {
        className:
          "bg-stone-50 text-stone-500 border-stone-200 dark:bg-stone-950 dark:text-stone-400 dark:border-stone-800",
        icon: <Ban className="w-3 h-3" />,
      };
    default:
      return {
        className: "bg-muted text-muted-foreground",
        icon: <Clock className="w-3 h-3" />,
      };
  }
}

function RunStatusBadge({ status }: { status: RunStatus }) {
  const { t } = useTranslation("runs");
  const { className, icon } = getRunStatusConfig(status);

  return (
    <Badge variant="outline" className={className}>
      {icon}
      {t(`status.${status}`, status)}
    </Badge>
  );
}

function StageProgressRow({
  label,
  status,
  completed,
  total,
}: {
  label: string;
  status: string;
  completed: number;
  total: number;
}) {
  const percent = total > 0 ? Math.round((completed / total) * 100) : 0;
  const { className } = getRunStatusConfig(status);

  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium text-foreground">{label}</span>
          <Badge variant="outline" className={className}>
            {status}
          </Badge>
        </div>
        <span className="text-xs text-muted-foreground">
          {completed}/{total}
        </span>
      </div>
      <Progress value={percent} />
    </div>
  );
}

function EngineBadge({ label }: { label: string }) {
  return <Badge variant="outline">{label}</Badge>;
}

function SentimentBadge({
  sentiment,
}: {
  sentiment: "positive" | "neutral" | "negative";
}) {
  const { t } = useTranslation("runs");

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

function NewRunDialog({
  open,
  onOpenChange,
  projectId,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  projectId: string;
}) {
  const { t } = useTranslation("runs");
  const { data: querySetsData } = useQuerySets(projectId);
  const { data: engines = [] } = useEngines();
  const createRun = useCreateRun(projectId);
  const querySets = querySetsData?.items ?? [];

  const [querySetId, setQuerySetId] = useState("");
  const [selectedEngineIds, setSelectedEngineIds] = useState<Set<string>>(
    new Set()
  );
  const [sampleCount, setSampleCount] = useState(5);

  function toggleEngine(engineId: string) {
    setSelectedEngineIds((prev) => {
      const next = new Set(prev);
      if (next.has(engineId)) {
        next.delete(engineId);
      } else {
        next.add(engineId);
      }
      return next;
    });
  }

  async function handleSubmit() {
    if (!querySetId || selectedEngineIds.size === 0) {
      return;
    }

    await Promise.all(
      Array.from(selectedEngineIds).map((engineId) =>
        createRun.mutateAsync({
          query_set_id: querySetId,
          engine_id: engineId,
          sample_count: sampleCount,
        })
      )
    );

    setQuerySetId("");
    setSelectedEngineIds(new Set());
    setSampleCount(5);
    onOpenChange(false);
  }

  const canSubmit = !!querySetId && selectedEngineIds.size > 0;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{t("newRun")}</DialogTitle>
          <DialogDescription>{t("subtitle")}</DialogDescription>
        </DialogHeader>
        <div className="space-y-6 py-2">
          <div className="space-y-2">
            <Label>{t("selectQuerySet")}</Label>
            <Select value={querySetId} onValueChange={setQuerySetId}>
              <SelectTrigger>
                <SelectValue placeholder={t("selectQuerySetPlaceholder")} />
              </SelectTrigger>
              <SelectContent>
                {querySets.map((querySet) => (
                  <SelectItem key={querySet.id} value={querySet.id}>
                    {querySet.name} ({querySet.query_count})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-3">
            <Label>{t("selectEngines")}</Label>
            <div className="grid grid-cols-2 gap-3">
              {engines.map((engine) => (
                <label
                  key={engine.id}
                  className="flex items-center gap-2.5 p-3 rounded-lg border border-border cursor-pointer hover:bg-accent/50 transition-colors has-[button[data-state=checked]]:border-primary has-[button[data-state=checked]]:bg-primary/5"
                >
                  <Checkbox
                    checked={selectedEngineIds.has(engine.id)}
                    onCheckedChange={() => toggleEngine(engine.id)}
                  />
                  <span className="text-sm font-medium text-foreground">
                    {engine.name}
                  </span>
                </label>
              ))}
            </div>
          </div>

          <div className="space-y-3">
            <Label>{t("sampleCount")}</Label>
            <div className="px-1">
              <Slider
                value={[sampleCount]}
                onValueChange={([value]) => setSampleCount(value ?? 1)}
                min={1}
                max={10}
                step={1}
              />
            </div>
            <p className="text-xs text-muted-foreground">
              {t("sampleCountHint", { count: sampleCount })}
            </p>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={!canSubmit || createRun.isPending}>
            {createRun.isPending ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Play className="w-4 h-4" />
            )}
            {t("createRun")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function ScheduleDialog({
  open,
  onOpenChange,
  projectId,
  schedule,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  projectId: string;
  schedule?: ScheduledRun | null;
}) {
  const { t } = useTranslation("runs");
  const { data: querySetsData } = useQuerySets(projectId);
  const { data: engines = [] } = useEngines();
  const createSchedule = useCreateSchedule(projectId);
  const updateSchedule = useUpdateSchedule(projectId);

  const querySets = querySetsData?.items ?? [];
  const activeEngines = engines.filter((engine) => engine.is_active);
  const [querySetId, setQuerySetId] = useState("");
  const [selectedEngineIds, setSelectedEngineIds] = useState<Set<string>>(new Set());
  const [sampleCount, setSampleCount] = useState(1);
  const [cronExpression, setCronExpression] = useState(DEFAULT_SCHEDULE_CRON);

  useEffect(() => {
    if (!open) {
      return;
    }

    if (schedule) {
      setQuerySetId(schedule.query_set_id);
      setSelectedEngineIds(new Set(schedule.engine_ids));
      setSampleCount(schedule.sample_count);
      setCronExpression(schedule.cron_expression);
      return;
    }

    setQuerySetId(querySets[0]?.id ?? "");
    setSelectedEngineIds(new Set(activeEngines.map((engine) => engine.id)));
    setSampleCount(1);
    setCronExpression(DEFAULT_SCHEDULE_CRON);
  }, [activeEngines, open, querySets, schedule]);

  function toggleEngine(engineId: string) {
    setSelectedEngineIds((prev) => {
      const next = new Set(prev);
      if (next.has(engineId)) {
        next.delete(engineId);
      } else {
        next.add(engineId);
      }
      return next;
    });
  }

  async function handleSubmit() {
    if (!querySetId || selectedEngineIds.size === 0 || !cronExpression.trim()) {
      return;
    }

    const payload = {
      query_set_id: querySetId,
      engine_ids: Array.from(selectedEngineIds),
      cron_expression: cronExpression.trim(),
      sample_count: sampleCount,
    };

    if (schedule) {
      await updateSchedule.mutateAsync({
        scheduleId: schedule.id,
        data: payload,
      });
    } else {
      await createSchedule.mutateAsync(payload);
    }

    onOpenChange(false);
  }

  const canSubmit =
    !!querySetId &&
    selectedEngineIds.size > 0 &&
    cronExpression.trim().length > 0;
  const isSaving = createSchedule.isPending || updateSchedule.isPending;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>
            {schedule ? t("schedules.editTitle") : t("schedules.createTitle")}
          </DialogTitle>
          <DialogDescription>{t("schedules.subtitle")}</DialogDescription>
        </DialogHeader>
        <div className="space-y-6 py-2">
          <div className="space-y-2">
            <Label>{t("selectQuerySet")}</Label>
            <Select value={querySetId} onValueChange={setQuerySetId}>
              <SelectTrigger>
                <SelectValue placeholder={t("selectQuerySetPlaceholder")} />
              </SelectTrigger>
              <SelectContent>
                {querySets.map((querySet) => (
                  <SelectItem key={querySet.id} value={querySet.id}>
                    {querySet.name} ({querySet.query_count})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-3">
            <Label>{t("selectEngines")}</Label>
            <div className="grid grid-cols-2 gap-3">
              {activeEngines.map((engine) => (
                <label
                  key={engine.id}
                  className="flex items-center gap-2.5 p-3 rounded-lg border border-border cursor-pointer hover:bg-accent/50 transition-colors has-[button[data-state=checked]]:border-primary has-[button[data-state=checked]]:bg-primary/5"
                >
                  <Checkbox
                    checked={selectedEngineIds.has(engine.id)}
                    onCheckedChange={() => toggleEngine(engine.id)}
                  />
                  <span className="text-sm font-medium text-foreground">
                    {engine.name}
                  </span>
                </label>
              ))}
            </div>
          </div>

          <div className="space-y-2">
            <Label>{t("schedules.cronLabel")}</Label>
            <Input
              value={cronExpression}
              onChange={(event) => setCronExpression(event.target.value)}
              placeholder={DEFAULT_SCHEDULE_CRON}
            />
            <p className="text-xs text-muted-foreground">
              {t("schedules.cronHint")}
            </p>
          </div>

          <div className="space-y-3">
            <Label>{t("sampleCount")}</Label>
            <div className="px-1">
              <Slider
                value={[sampleCount]}
                onValueChange={([value]) => setSampleCount(value ?? 1)}
                min={1}
                max={10}
                step={1}
              />
            </div>
            <p className="text-xs text-muted-foreground">
              {t("sampleCountHint", { count: sampleCount })}
            </p>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            {t("schedules.cancel")}
          </Button>
          <Button onClick={handleSubmit} disabled={!canSubmit || isSaving}>
            {isSaving ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <CalendarClock className="w-4 h-4" />
            )}
            {schedule ? t("schedules.save") : t("schedules.create")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

const TERMINAL_STATUSES = new Set(["completed", "failed", "partial", "cancelled"]);

function RunProgressCard({
  projectId,
  runId,
  engineName,
  querySetName,
}: {
  projectId: string;
  runId: string;
  engineName?: string;
  querySetName?: string;
}) {
  const { t } = useTranslation("runs");
  const { data: progress } = useRunProgress(projectId, runId);
  const cancelRun = useCancelRun(projectId);
  const queryClient = useQueryClient();

  useEffect(() => {
    if (progress?.status && TERMINAL_STATUSES.has(progress.status)) {
      queryClient.invalidateQueries({ queryKey: ["runs", projectId] });
    }
  }, [progress?.status, projectId, queryClient]);

  if (!progress) {
    return null;
  }

  return (
    <Card>
      <CardContent className="space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Loader2 className="w-4 h-4 animate-spin text-teal-600" />
            <span className="font-medium text-foreground">
              {t("progress.title")}
            </span>
            {engineName && <EngineBadge label={engineName} />}
            {querySetName && (
              <span className="text-xs text-muted-foreground">{querySetName}</span>
            )}
          </div>
          <div className="flex items-center gap-2">
            <RunStatusBadge status={progress.status as RunStatus} />
            <Button
              variant="outline"
              size="sm"
              onClick={() => cancelRun.mutate(runId)}
              disabled={cancelRun.isPending}
            >
              {cancelRun.isPending ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <Ban className="w-3.5 h-3.5" />
              )}
              {t("cancel")}
            </Button>
          </div>
        </div>
        <StageProgressRow
          label={t("progress.engine")}
          status={progress.engine.status}
          completed={progress.engine.completed}
          total={progress.engine.total}
        />
        <StageProgressRow
          label={t("progress.parse")}
          status={progress.parse.status}
          completed={progress.parse.completed}
          total={progress.parse.total}
        />
        <StageProgressRow
          label={t("progress.score")}
          status={progress.score.status}
          completed={progress.score.completed}
          total={progress.score.total}
        />
        {progress.error_message && (
          <p className="text-sm text-amber-700 dark:text-amber-300">
            {progress.error_message}
          </p>
        )}
      </CardContent>
    </Card>
  );
}

function AnswerCard({ answer }: { answer: AnswerExplorerItem }) {
  const { t } = useTranslation("runs");
  const [expanded, setExpanded] = useState(false);
  const mentions = answer.mentions ?? [];
  const citations = answer.citations ?? [];
  const hasRecommendation = mentions.some((mention) => mention.is_recommended);
  const sentiment = mentions.some((mention) => mention.sentiment === "negative")
    ? "negative"
    : mentions.some((mention) => mention.sentiment === "positive")
      ? "positive"
      : "neutral";

  return (
    <Card>
      <CardContent className="pt-5 pb-4 space-y-3">
        <div className="flex items-start justify-between gap-4">
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-foreground">
              {answer.query_text}
            </p>
            <p className="text-xs text-muted-foreground mt-1">
              Sample #{answer.sample_index + 1}
            </p>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            {answer.score && (
              <div className="flex items-center gap-1 text-sm">
                <Star className="w-3.5 h-3.5 text-amber-500" />
                <span className="font-semibold text-foreground">
                  {answer.score.total_score.toFixed(1)}
                </span>
              </div>
            )}
            <SentimentBadge sentiment={sentiment} />
          </div>
        </div>

        <div
          className="text-sm text-muted-foreground cursor-pointer"
          onClick={() => setExpanded(!expanded)}
        >
          {expanded
            ? answer.raw_response
            : answer.raw_response.length > 200
              ? answer.raw_response.slice(0, 200) + "..."
              : answer.raw_response}
        </div>

        <div className="flex items-center gap-3 pt-1">
          <Badge
            variant="outline"
            className={
              citations.length > 0
                ? "bg-green-50 text-green-700 border-green-200 dark:bg-green-950 dark:text-green-300 dark:border-green-800"
                : "text-muted-foreground"
            }
          >
            <Quote className="w-3 h-3" />
            {citations.length > 0
              ? `${t("detail.cited")} (${citations.length})`
              : t("detail.notCited")}
          </Badge>
          <Badge
            variant="outline"
            className={
              hasRecommendation
                ? "bg-teal-50 text-teal-700 border-teal-200 dark:bg-teal-950 dark:text-teal-300 dark:border-teal-800"
                : "text-muted-foreground"
            }
          >
            <ThumbsUp className="w-3 h-3" />
            {hasRecommendation
              ? t("detail.recommended")
              : t("detail.notRecommended")}
          </Badge>
        </div>
      </CardContent>
    </Card>
  );
}

function RunDetailView({
  projectId,
  run,
  engineName,
  querySetName,
  onBack,
  onRetry,
  retrying,
}: {
  projectId: string;
  run: EngineRun;
  engineName: string;
  querySetName: string;
  onBack: () => void;
  onRetry: (runId: string) => Promise<unknown>;
  retrying: boolean;
}) {
  const { t } = useTranslation("runs");
  const { locale } = useLocale();
  const { data: progress } = useRunProgress(projectId, run.id);
  const { data: scoreSummary } = useScoreSummary(projectId, run.id);
  const { data: answersData, isLoading: answersLoading } = useAnswers(projectId, {
    runId: run.id,
  });
  const answers = answersData?.items ?? [];
  const isRunning = run.status === "running" || run.status === "pending";
  const canRetry =
    run.status === "failed" ||
    run.status === "partial" ||
    run.status === "cancelled" ||
    run.status === "running";
  const queryCount = progress
    ? Math.ceil(progress.engine.total / Math.max(run.sample_count, 1))
    : null;

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon-xs" onClick={onBack}>
          <ArrowLeft className="w-4 h-4" />
        </Button>
        <div className="flex items-center gap-3">
          <h3 className="text-lg font-semibold text-foreground">
            {t("detail.title")}
          </h3>
          <EngineBadge label={engineName} />
          <RunStatusBadge status={run.status} />
        </div>
        {canRetry && (
          <Button
            variant="outline"
            onClick={() => void onRetry(run.id)}
            disabled={retrying}
          >
            {retrying ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <RotateCcw className="w-4 h-4" />
            )}
            {t("retry")}
          </Button>
        )}
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-5 gap-4">
        <Card>
          <CardContent className="pt-4 pb-4">
            <p className="text-xs text-muted-foreground mb-1">
              {t("table.querySet")}
            </p>
            <p className="text-sm font-medium text-foreground">
              {querySetName}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-4">
            <p className="text-xs text-muted-foreground mb-1">
              {t("sampleCount")}
            </p>
            <p className="text-xl font-bold text-foreground">
              {run.sample_count}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-4">
            <p className="text-xs text-muted-foreground mb-1">
              {t("table.queries")}
            </p>
            <p className="text-xl font-bold text-foreground">
              {queryCount ?? "--"}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-4">
            <p className="text-xs text-muted-foreground mb-1">
              {t("table.score")}
            </p>
            <p className="text-xl font-bold text-foreground">
              {scoreSummary ? scoreSummary.total_score.toFixed(1) : "--"}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-4">
            <p className="text-xs text-muted-foreground mb-1">
              {t("table.date")}
            </p>
            <p className="text-sm font-medium text-foreground">
              {formatDate(run.created_at, locale)}
            </p>
          </CardContent>
        </Card>
      </div>

      {run.error_message && (
        <Card className="border-amber-200 dark:border-amber-800">
          <CardContent className="pt-4 pb-4 flex items-start gap-3">
            <AlertCircle className="w-4 h-4 text-amber-600 mt-0.5" />
            <div className="space-y-1">
              <p className="text-sm font-medium text-foreground">
                {t("detail.pipelineIssue")}
              </p>
              <p className="text-sm text-muted-foreground">{run.error_message}</p>
            </div>
          </CardContent>
        </Card>
      )}

      {isRunning && <RunProgressCard projectId={projectId} runId={run.id} />}

      <div>
        <h4 className="text-base font-semibold text-foreground mb-4">
          {t("detail.answers")}
        </h4>

        {answersLoading && (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
          </div>
        )}

        {!answersLoading && answers.length === 0 && (
          <Card>
            <CardContent className="py-12 text-center text-muted-foreground">
              {t("emptyAnswers")}
            </CardContent>
          </Card>
        )}

        {!answersLoading && answers.length > 0 && (
          <div className="space-y-3">
            {answers.map((answer) => (
              <AnswerCard key={answer.id} answer={answer} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function ScoreBreakdown({ projectId, runId }: { projectId: string; runId: string }) {
  const { t } = useTranslation("runs");
  const { data: score, isLoading } = useScoreSummary(projectId, runId);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-4">
        <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!score) return null;

  const dimensions = [
    { key: "mention", value: score.mention_score },
    { key: "sentiment", value: score.sentiment_score },
    { key: "position", value: score.position_score },
    { key: "accuracy", value: score.accuracy_score },
    { key: "citation", value: score.citation_score },
    { key: "recommendation", value: score.recommendation_score },
  ] as const;

  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 py-3 px-4">
      {dimensions.map(({ key, value }) => (
        <div key={key} className="space-y-1.5">
          <span className="text-xs text-muted-foreground">{t(`scores.${key}`)}</span>
          <div className="flex items-center gap-2">
            <div className="h-1.5 flex-1 rounded-full bg-muted">
              <div
                className="h-full rounded-full bg-teal-600 transition-all"
                style={{ width: `${Math.min((value / 10) * 100, 100)}%` }}
              />
            </div>
            <span className="text-sm font-semibold text-foreground w-8 text-right">
              {value.toFixed(1)}
            </span>
          </div>
        </div>
      ))}
    </div>
  );
}

function RunTableRow({
  run,
  projectId,
  engineName,
  querySetName,
  onViewDetail,
  onRetry,
  onCancel,
  retryingRunId,
  cancellingRunId,
}: {
  run: EngineRun;
  projectId: string;
  engineName: string;
  querySetName: string;
  onViewDetail: (run: EngineRun) => void;
  onRetry: (runId: string) => Promise<unknown>;
  onCancel: (runId: string) => void;
  retryingRunId: string | null;
  cancellingRunId: string | null;
}) {
  const { t } = useTranslation("runs");
  const { locale } = useLocale();
  const [expanded, setExpanded] = useState(false);
  const hasScore = run.status === "completed" || run.status === "partial";
  const { data: scoreSummary } = useScoreSummary(projectId, hasScore ? run.id : undefined);

  return (
    <>
      <TableRow>
        <TableCell>
          <EngineBadge label={engineName} />
        </TableCell>
        <TableCell>
          <span className="text-foreground font-medium">{querySetName}</span>
        </TableCell>
        <TableCell className="text-muted-foreground">{run.sample_count}</TableCell>
        <TableCell>
          <RunStatusBadge status={run.status} />
        </TableCell>
        <TableCell>
          {hasScore ? (
            <button
              type="button"
              onClick={() => setExpanded(!expanded)}
              className="inline-flex items-center gap-1.5 rounded-md bg-teal-50 px-2.5 py-1 text-sm font-semibold text-teal-700 transition-colors hover:bg-teal-100 dark:bg-teal-950 dark:text-teal-300 dark:hover:bg-teal-900"
            >
              {scoreSummary ? scoreSummary.total_score.toFixed(1) : "—"}
              {expanded ? (
                <ChevronUp className="w-3.5 h-3.5" />
              ) : (
                <ChevronDown className="w-3.5 h-3.5" />
              )}
            </button>
          ) : (
            <span className="text-muted-foreground">—</span>
          )}
        </TableCell>
        <TableCell className="text-muted-foreground">
          {formatDate(run.created_at, locale)}
        </TableCell>
        <TableCell className="text-right">
          <div className="flex items-center justify-end gap-2">
            {(run.status === "running" || run.status === "pending") && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => onCancel(run.id)}
                disabled={cancellingRunId === run.id}
              >
                {cancellingRunId === run.id ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Ban className="w-4 h-4" />
                )}
                {t("cancel")}
              </Button>
            )}
            {(run.status === "failed" ||
              run.status === "partial" ||
              run.status === "cancelled" ||
              run.status === "running") && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => void onRetry(run.id)}
                disabled={retryingRunId === run.id}
              >
                {retryingRunId === run.id ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <RotateCcw className="w-4 h-4" />
                )}
                {t("retry")}
              </Button>
            )}
            <Button variant="ghost" size="sm" onClick={() => onViewDetail(run)}>
              {t("viewDetails")}
            </Button>
          </div>
        </TableCell>
      </TableRow>
      {expanded && hasScore && (
        <TableRow className="bg-muted/30 hover:bg-muted/30">
          <TableCell colSpan={7} className="p-0">
            <ScoreBreakdown projectId={projectId} runId={run.id} />
          </TableCell>
        </TableRow>
      )}
    </>
  );
}

function RunsTable({
  runs,
  isLoading,
  projectId,
  engineNames,
  querySetNames,
  onViewDetail,
  onRetry,
  onCancel,
  retryingRunId,
  cancellingRunId,
}: {
  runs: EngineRun[];
  isLoading: boolean;
  projectId: string;
  engineNames: Record<string, string>;
  querySetNames: Record<string, string>;
  onViewDetail: (run: EngineRun) => void;
  onRetry: (runId: string) => Promise<unknown>;
  onCancel: (runId: string) => void;
  retryingRunId: string | null;
  cancellingRunId: string | null;
}) {
  const { t } = useTranslation("runs");

  return (
    <Card>
      <CardContent className="p-0">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{t("table.engine")}</TableHead>
              <TableHead>{t("table.querySet")}</TableHead>
              <TableHead>{t("sampleCount")}</TableHead>
              <TableHead>{t("table.status")}</TableHead>
              <TableHead>{t("table.score")}</TableHead>
              <TableHead>{t("table.date")}</TableHead>
              <TableHead className="text-right">{t("table.actions")}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading && (
              <TableRow>
                <TableCell colSpan={7} className="h-24 text-center">
                  <Loader2 className="w-5 h-5 animate-spin mx-auto text-muted-foreground" />
                </TableCell>
              </TableRow>
            )}
            {!isLoading &&
              runs.map((run) => (
                <RunTableRow
                  key={run.id}
                  run={run}
                  projectId={projectId}
                  engineName={engineNames[run.engine_id] ?? run.engine_id.slice(0, 8)}
                  querySetName={querySetNames[run.query_set_id] ?? run.query_set_id.slice(0, 8)}
                  onViewDetail={onViewDetail}
                  onRetry={onRetry}
                  onCancel={onCancel}
                  retryingRunId={retryingRunId}
                  cancellingRunId={cancellingRunId}
                />
              ))}
            {!isLoading && runs.length === 0 && (
              <TableRow>
                <TableCell colSpan={7} className="h-24 text-center text-muted-foreground">
                  {t("emptyState")}
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}

function SchedulesCard({
  projectId,
  schedules,
  querySets,
  engines,
}: {
  projectId: string;
  schedules: ScheduledRun[];
  querySets: { id: string; name: string }[];
  engines: { id: string; name: string; is_active: boolean }[];
}) {
  const { t } = useTranslation("runs");
  const [showScheduleDialog, setShowScheduleDialog] = useState(false);
  const [editingSchedule, setEditingSchedule] = useState<ScheduledRun | null>(null);
  const updateSchedule = useUpdateSchedule(projectId);
  const deleteSchedule = useDeleteSchedule(projectId);

  const querySetNames = Object.fromEntries(querySets.map((querySet) => [querySet.id, querySet.name]));
  const engineNames = Object.fromEntries(engines.map((engine) => [engine.id, engine.name]));
  const activeEngines = engines.filter((engine) => engine.is_active);
  const canCreateSchedule = querySets.length > 0 && activeEngines.length > 0;

  function openCreateDialog() {
    setEditingSchedule(null);
    setShowScheduleDialog(true);
  }

  function openEditDialog(schedule: ScheduledRun) {
    setEditingSchedule(schedule);
    setShowScheduleDialog(true);
  }

  async function toggleSchedule(schedule: ScheduledRun) {
    setEditingSchedule(schedule);
    await updateSchedule.mutateAsync({
      scheduleId: schedule.id,
      data: {
        is_active: !schedule.is_active,
      },
    });
  }

  return (
    <>
      <Card>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between gap-4">
            <div>
              <h4 className="text-base font-semibold text-foreground">
                {t("schedules.title")}
              </h4>
              <p className="text-sm text-muted-foreground">
                {t("schedules.description")}
              </p>
            </div>
            <Button onClick={openCreateDialog} disabled={!canCreateSchedule}>
              <CalendarClock className="w-4 h-4" />
              {t("schedules.create")}
            </Button>
          </div>

          {!canCreateSchedule && (
            <p className="text-sm text-muted-foreground">
              {querySets.length === 0
                ? t("schedules.missingQuerySets")
                : t("schedules.missingEngines")}
            </p>
          )}

          {schedules.length === 0 ? (
            <div className="rounded-lg border border-dashed border-border px-4 py-8 text-center">
              <p className="text-sm text-muted-foreground">
                {t("schedules.emptyState")}
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {schedules.map((schedule) => (
                <div
                  key={schedule.id}
                  className="rounded-lg border border-border p-4 space-y-3"
                >
                  <div className="flex items-center justify-between gap-3">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <Badge variant="outline">
                          {schedule.is_active ? t("schedules.active") : t("schedules.paused")}
                        </Badge>
                        <span className="text-sm font-medium text-foreground">
                          {querySetNames[schedule.query_set_id] ?? schedule.query_set_id.slice(0, 8)}
                        </span>
                      </div>
                      <p className="text-xs text-muted-foreground">
                        {t("schedules.cronValue", { cron: schedule.cron_expression })}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => void toggleSchedule(schedule)}
                        disabled={updateSchedule.isPending && editingSchedule?.id === schedule.id}
                      >
                        {updateSchedule.isPending && editingSchedule?.id === schedule.id ? (
                          <Loader2 className="w-4 h-4 animate-spin" />
                        ) : schedule.is_active ? (
                          <Pause className="w-4 h-4" />
                        ) : (
                          <Play className="w-4 h-4" />
                        )}
                        {schedule.is_active ? t("schedules.pause") : t("schedules.resume")}
                      </Button>
                      <Button variant="outline" size="sm" onClick={() => openEditDialog(schedule)}>
                        <Pencil className="w-4 h-4" />
                        {t("schedules.edit")}
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => deleteSchedule.mutate(schedule.id)}
                        disabled={deleteSchedule.isPending}
                      >
                        {deleteSchedule.isPending ? (
                          <Loader2 className="w-4 h-4 animate-spin" />
                        ) : (
                          <XCircle className="w-4 h-4" />
                        )}
                        {t("schedules.delete")}
                      </Button>
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                    <span>{t("schedules.sampleCountValue", { count: schedule.sample_count })}</span>
                    <span>•</span>
                    <span>
                      {t("schedules.engineCountValue", { count: schedule.engine_ids.length })}
                    </span>
                  </div>

                  <div className="flex flex-wrap gap-2">
                    {schedule.engine_ids.map((engineId) => (
                      <Badge key={engineId} variant="secondary">
                        {engineNames[engineId] ?? engineId.slice(0, 8)}
                      </Badge>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <ScheduleDialog
        open={showScheduleDialog}
        onOpenChange={(open) => {
          setShowScheduleDialog(open);
          if (!open) {
            setEditingSchedule(null);
          }
        }}
        projectId={projectId}
        schedule={editingSchedule}
      />
    </>
  );
}

function RunsSkeleton() {
  return (
    <Card>
      <CardContent className="p-0">
        <div className="p-4 space-y-4">
          {[1, 2, 3, 4].map((index) => (
            <div key={index} className="flex items-center gap-4">
              <Skeleton className="h-6 w-20" />
              <Skeleton className="h-4 w-32" />
              <Skeleton className="h-4 w-16" />
              <Skeleton className="h-6 w-20" />
              <Skeleton className="h-4 w-24" />
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

function RunsPage() {
  const { projectId } = useParams({
    from: "/_dashboard/projects/$projectId/runs",
  });
  const { t } = useTranslation("runs");
  const { data, isLoading } = useRuns(projectId);
  const { data: schedules = [] } = useSchedules(projectId);
  const { data: querySetsData } = useQuerySets(projectId);
  const { data: engines = [] } = useEngines();
  const retryRun = useRetryRun(projectId);
  const cancelRun = useCancelRun(projectId);

  const runs = data?.items ?? [];
  const querySets = querySetsData?.items ?? [];
  const engineNames = Object.fromEntries(engines.map((engine) => [engine.id, engine.name]));
  const querySetNames = Object.fromEntries(querySets.map((querySet) => [querySet.id, querySet.name]));

  const [showNewRunDialog, setShowNewRunDialog] = useState(false);
  const [selectedRun, setSelectedRun] = useState<EngineRun | null>(null);
  const selectedRunRecord = selectedRun
    ? runs.find((run) => run.id === selectedRun.id) ?? selectedRun
    : null;

  async function handleRetry(runId: string) {
    await retryRun.mutateAsync(runId);
  }

  if (selectedRunRecord) {
    return (
      <RunDetailView
        projectId={projectId}
        run={selectedRunRecord}
        engineName={
          engineNames[selectedRunRecord.engine_id] ??
          selectedRunRecord.engine_id.slice(0, 8)
        }
        querySetName={
          querySetNames[selectedRunRecord.query_set_id] ??
          selectedRunRecord.query_set_id.slice(0, 8)
        }
        onBack={() => setSelectedRun(null)}
        onRetry={handleRetry}
        retrying={retryRun.isPending && retryRun.variables === selectedRunRecord.id}
      />
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold text-foreground">
            {t("runHistory")}
          </h3>
          <p className="text-sm text-muted-foreground mt-0.5">
            {t("subtitle")}
          </p>
        </div>
        <Button onClick={() => setShowNewRunDialog(true)}>
          <Play className="w-4 h-4" />
          {t("newRun")}
        </Button>
      </div>

      {runs
        .filter((run) => run.status === "running" || run.status === "pending")
        .map((run) => (
          <RunProgressCard
            key={run.id}
            projectId={projectId}
            runId={run.id}
            engineName={engineNames[run.engine_id]}
            querySetName={querySetNames[run.query_set_id]}
          />
        ))}

      <SchedulesCard
        projectId={projectId}
        schedules={schedules}
        querySets={querySets.map((querySet) => ({
          id: querySet.id,
          name: querySet.name,
        }))}
        engines={engines.map((engine) => ({
          id: engine.id,
          name: engine.name,
          is_active: engine.is_active,
        }))}
      />

      {isLoading && <RunsSkeleton />}

      {!isLoading && runs.length === 0 && (
        <Card>
          <CardContent className="py-12">
            <div className="text-center space-y-3">
              <div className="mx-auto w-12 h-12 rounded-full bg-muted flex items-center justify-center">
                <Zap className="w-6 h-6 text-muted-foreground" />
              </div>
              <p className="text-muted-foreground">{t("emptyState")}</p>
              <Button variant="outline" onClick={() => setShowNewRunDialog(true)}>
                <Play className="w-4 h-4" />
                {t("newRun")}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {!isLoading && runs.length > 0 && (
        <RunsTable
          runs={runs}
          isLoading={false}
          projectId={projectId}
          engineNames={engineNames}
          querySetNames={querySetNames}
          onViewDetail={setSelectedRun}
          onRetry={handleRetry}
          onCancel={(runId) => cancelRun.mutate(runId)}
          retryingRunId={retryRun.isPending ? retryRun.variables ?? null : null}
          cancellingRunId={cancelRun.isPending ? cancelRun.variables ?? null : null}
        />
      )}

      <NewRunDialog
        open={showNewRunDialog}
        onOpenChange={setShowNewRunDialog}
        projectId={projectId}
      />
    </div>
  );
}
