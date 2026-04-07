import { useEffect, useRef } from "react";
import { useTranslation } from "react-i18next";
import {
  Loader2,
  CheckCircle2,
  ArrowLeft,
  XCircle,
  Bot,
  Circle,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { useEngines } from "@/hooks/use-engines";
import {
  useRunProgressStream,
  type RunProgressState,
  type StageProgress,
} from "@/hooks/use-run-progress-stream";
import { apiGet, apiPost } from "@/lib/api-client";
import type { EngineRun } from "@/types/run";
import type { Query } from "@/types/query";

interface StepRunEnginesProps {
  projectId: string;
  querySetId: string;
  onContinue: (runIds: string[]) => void;
  onBack: () => void;
}

const STAGE_KEYS = ["engine", "parse", "score"] as const;

function StageIcon({ status }: { status: string }) {
  if (status === "running")
    return <Loader2 className="h-3.5 w-3.5 animate-spin text-primary" />;
  if (status === "completed")
    return <CheckCircle2 className="h-3.5 w-3.5 text-primary" />;
  if (status === "failed" || status === "partial")
    return <XCircle className="h-3.5 w-3.5 text-destructive" />;
  return <Circle className="h-3.5 w-3.5 text-muted-foreground/40" />;
}

function StageIndicator({
  stages,
}: {
  stages: [StageProgress, StageProgress, StageProgress];
}) {
  return (
    <div className="flex items-center gap-1">
      {stages.map((stage, i) => (
        <div key={i} className="contents">
          {i > 0 && (
            <div
              className={cn(
                "h-px flex-1",
                stage.status !== "pending" ? "bg-primary" : "bg-border",
              )}
            />
          )}
          <StageIcon status={stage.status} />
        </div>
      ))}
    </div>
  );
}

function getActiveStage(run: RunProgressState) {
  for (const key of STAGE_KEYS) {
    const stage = run[key];
    if (stage.status === "running") return { key, ...stage };
  }
  // Show the last non-pending stage
  for (let i = STAGE_KEYS.length - 1; i >= 0; i--) {
    const key = STAGE_KEYS[i]!;
    const stage = run[key];
    if (stage.status !== "pending") return { key, ...stage };
  }
  return null;
}

function EngineRunCard({
  run,
  t,
}: {
  run: RunProgressState;
  t: ReturnType<typeof useTranslation>["t"];
}) {
  const active = getActiveStage(run);
  const isDone = run.status === "completed" || run.status === "partial";
  const isFailed = run.status === "failed";

  return (
    <Card className="text-left">
      <CardHeader className="pb-2">
        <div className="flex items-center gap-3">
          <Bot className="h-5 w-5 text-muted-foreground" />
          <CardTitle className="text-sm font-medium">
            {run.engineName}
          </CardTitle>
          <span className="ml-auto">
            {isDone && <CheckCircle2 className="h-4 w-4 text-primary" />}
            {isFailed && <XCircle className="h-4 w-4 text-destructive" />}
            {!isDone && !isFailed && (
              <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
            )}
          </span>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        <StageIndicator stages={[run.engine, run.parse, run.score]} />
        {active && !isDone && (
          <>
            <div className="flex items-center justify-between text-xs text-muted-foreground">
              <span>{t(`runEngines.stages.${active.key}`)}</span>
              <span>
                {active.completed}/{active.total}
              </span>
            </div>
            <Progress
              value={
                active.total > 0
                  ? (active.completed / active.total) * 100
                  : 0
              }
              className="h-1.5"
            />
          </>
        )}
        {isDone && (
          <p className="text-xs text-muted-foreground">
            {t("runEngines.stageStatus.completed")}
          </p>
        )}
        {isFailed && (
          <p className="text-xs text-destructive">
            {run.errorMessage || t("runEngines.stageStatus.failed")}
          </p>
        )}
      </CardContent>
    </Card>
  );
}

export function StepRunEngines({
  projectId,
  querySetId,
  onContinue,
  onBack,
}: StepRunEnginesProps) {
  const { t } = useTranslation("funnel");
  const { data: engines } = useEngines();
  const stream = useRunProgressStream(projectId);
  const started = useRef(false);
  const runIdsRef = useRef<string[]>([]);

  const runs = Object.values(stream.runs);
  const allDone = stream.phase === "complete";

  useEffect(() => {
    if (started.current || !engines?.length) return;
    started.current = true;

    (async () => {
      try {
        // Approve all queries first
        const res = await apiGet<{ items: Query[] }>(
          `/projects/${projectId}/query-sets/${querySetId}/queries?limit=100`,
        );
        const pendingIds = res.items
          .filter((q) => q.status !== "approved")
          .map((q) => q.id);
        if (pendingIds.length > 0) {
          await apiPost(
            `/projects/${projectId}/query-sets/${querySetId}/queries/batch-update`,
            { query_ids: pendingIds, status: "approved" },
          );
        }

        // Launch runs for 2 engines
        const activeEngines = engines.slice(0, 2);
        const launchedIds: string[] = [];
        const engineMap: Record<string, string> = {};

        for (const engine of activeEngines) {
          try {
            const run = await apiPost<EngineRun>(
              `/projects/${projectId}/runs`,
              {
                query_set_id: querySetId,
                engine_id: engine.id,
                sample_count: 1,
              },
            );
            launchedIds.push(run.id);
            engineMap[run.id] = engine.name;
          } catch {
            // Skip failed engines
          }
        }

        if (launchedIds.length === 0) {
          toast.error(t("runEngines.failed"));
          return;
        }

        runIdsRef.current = launchedIds;
        stream.start(launchedIds, engineMap);
      } catch {
        toast.error(t("runEngines.failed"));
      }
    })();
  }, [engines]);

  return (
    <div className="w-full space-y-8 text-center">
      <div>
        <h1 className="text-2xl font-bold">{t("runEngines.heading")}</h1>
        <p className="mt-2 text-muted-foreground">
          {t("runEngines.description")}
        </p>
      </div>

      <div className="mx-auto max-w-md space-y-3">
        {runs.length === 0 && !allDone && (
          <div className="flex items-center justify-center gap-2 text-muted-foreground">
            <Loader2 className="h-5 w-5 animate-spin" />
            <span>{t("runEngines.launching")}</span>
          </div>
        )}

        {runs.map((run) => (
          <EngineRunCard key={run.runId} run={run} t={t} />
        ))}

        {allDone && (
          <div className="flex items-center justify-center gap-2 text-primary">
            <CheckCircle2 className="h-5 w-5" />
            <span className="font-medium">{t("runEngines.complete")}</span>
          </div>
        )}

        {stream.phase === "error" && (
          <p className="text-sm text-destructive">{stream.error}</p>
        )}
      </div>

      <div className="flex items-center justify-center gap-3">
        <Button variant="outline" onClick={onBack}>
          <ArrowLeft className="mr-2 h-4 w-4" />
          {t("navigation.back")}
        </Button>
        <Button
          size="lg"
          onClick={() => onContinue(runIdsRef.current)}
          disabled={!allDone}
        >
          {t("navigation.continue")}
        </Button>
      </div>
    </div>
  );
}
