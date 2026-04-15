import { useRef, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import {
  FileText,
  Lightbulb,
  Loader2,
  Search,
  Target,
  Wrench,
} from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import { AvopPageHeader } from "@/components/avop";
import { OverviewAssistantInsight } from "@/components/dashboard/overview-assistant-insight";
import { ExplorerProjectSelect } from "@/components/explorer/explorer-project-select";
import { useExplorerProjectId } from "@/hooks/use-explorer-project";
import { useDashboardPeriod } from "@/hooks/use-dashboard-period";
import {
  useGenerateRecommendations,
  usePatchRecommendationStatus,
  useRecommendations,
} from "@/hooks/use-recommendations";
import { useLatestRun } from "@/hooks/use-runs";
import {
  streamAssistantChat,
  streamAssistantReport,
} from "@/lib/assistant-stream";
import { ApiError } from "@/lib/api-client";

export const Route = createFileRoute("/_dashboard/assistant")({
  component: AssistantPage,
});

const categoryIcons: Record<string, typeof Lightbulb> = {
  content: FileText,
  seo: Search,
  brand_positioning: Target,
  technical: Wrench,
};

const priorityClass: Record<string, string> = {
  high: "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200",
  medium: "bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-200",
  low: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200",
};

function AssistantPage() {
  const { t } = useTranslation("explorer");
  const period = useDashboardPeriod();
  const {
    projectId,
    projects,
    isLoadingProjects,
    setPreferredProjectId,
  } = useExplorerProjectId();
  const [reportText, setReportText] = useState("");
  const [reportLoading, setReportLoading] = useState(false);
  const [chatInput, setChatInput] = useState("");
  const [chatOut, setChatOut] = useState("");
  const [chatLoading, setChatLoading] = useState(false);
  const [chatError, setChatError] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  const latestRun = useLatestRun(projectId ?? undefined);
  const recommendations = useRecommendations(projectId ?? undefined);
  const generateRecs = useGenerateRecommendations(projectId ?? undefined);
  const patchRec = usePatchRecommendationStatus(projectId ?? undefined);

  const runReport = async () => {
    if (!projectId) return;
    setReportLoading(true);
    setReportText("");
    abortRef.current?.abort();
    abortRef.current = new AbortController();
    try {
      await streamAssistantReport(
        projectId,
        period,
        (chunk) => setReportText((prev) => prev + chunk),
        abortRef.current.signal,
      );
    } catch (e) {
      setReportText(
        e instanceof ApiError ? e.code : (e as Error).message ?? "Error",
      );
    } finally {
      setReportLoading(false);
    }
  };

  const sendChat = async () => {
    if (!projectId || !chatInput.trim()) return;
    setChatLoading(true);
    setChatError(null);
    setChatOut("");
    try {
      await streamAssistantChat(
        projectId,
        { message: chatInput.trim(), history: [] },
        (chunk) => setChatOut((prev) => prev + chunk),
      );
      setChatInput("");
    } catch (e) {
      setChatError(
        e instanceof ApiError ? e.code : (e as Error).message ?? "Error",
      );
    } finally {
      setChatLoading(false);
    }
  };

  return (
    <div className="space-y-8">
      <div>
        <AvopPageHeader
          title={t("assistant.title")}
          description={t("assistant.subtitle")}
        />
      </div>

      {isLoadingProjects ? (
        <Skeleton className="h-10 w-full max-w-md" />
      ) : projects.length === 0 ? (
        <p className="text-sm text-muted-foreground">{t("emptyProjects")}</p>
      ) : (
        <ExplorerProjectSelect
          projects={projects}
          value={projectId}
          onChange={setPreferredProjectId}
        />
      )}

      {projectId ? <OverviewAssistantInsight projectId={projectId} /> : null}

      <Card>
        <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <CardTitle>{t("assistant.recommendationsTitle")}</CardTitle>
            <CardDescription>
              {t("assistant.recommendationsSubtitle")}
            </CardDescription>
          </div>
          <Button
            variant="outline"
            size="sm"
            disabled={!projectId || generateRecs.isPending}
            onClick={() => {
              if (!projectId) return;
              const runId =
                latestRun.data?.status === "completed"
                  ? latestRun.data.run_id
                  : undefined;
              generateRecs.mutate(
                runId ? { run_id: runId } : {},
                {
                  onError: () =>
                    toast.error(t("assistant.recommendationsGenerateError")),
                },
              );
            }}
          >
            {generateRecs.isPending ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                {t("assistant.recommendationsGenerating")}
              </>
            ) : (
              t("assistant.generateRecommendations")
            )}
          </Button>
        </CardHeader>
        <CardContent className="space-y-3">
          {!projectId ? (
            <p className="text-sm text-muted-foreground">{t("emptyProjects")}</p>
          ) : recommendations.isLoading ? (
            <div className="space-y-2">
              <Skeleton className="h-16 w-full" />
              <Skeleton className="h-16 w-full" />
            </div>
          ) : recommendations.error ? (
            <p className="text-sm text-destructive">
              {(recommendations.error as Error).message}
            </p>
          ) : !recommendations.data?.length ? (
            <p className="text-sm text-muted-foreground">
              {t("assistant.recommendationsEmpty")}
            </p>
          ) : (
            <ul className="space-y-3">
              {recommendations.data.map((rec) => {
                const Icon = categoryIcons[rec.category] ?? Lightbulb;
                const done = rec.status === "done";
                return (
                  <li
                    key={rec.id}
                    className={`rounded-lg border p-3 ${done ? "opacity-60" : ""}`}
                  >
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <div className="flex min-w-0 flex-1 gap-2">
                        <Icon className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
                        <div className="min-w-0 space-y-1">
                          <p className="text-sm font-medium leading-snug">
                            {rec.title}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {rec.description}
                          </p>
                        </div>
                      </div>
                      <div className="flex shrink-0 flex-wrap items-center gap-1">
                        <Badge
                          variant="secondary"
                          className={`text-xs ${priorityClass[rec.priority] ?? ""}`}
                        >
                          {rec.priority}
                        </Badge>
                        {done ? (
                          <Badge variant="outline" className="text-xs">
                            {t("assistant.recommendationDone")}
                          </Badge>
                        ) : (
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-7 text-xs"
                            disabled={patchRec.isPending}
                            onClick={() =>
                              patchRec.mutate({ id: rec.id, status: "done" })
                            }
                          >
                            {t("assistant.markDone")}
                          </Button>
                        )}
                      </div>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{t("assistant.reportTitle")}</CardTitle>
          <CardDescription>{period}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <Button
            disabled={!projectId || reportLoading}
            onClick={() => void runReport()}
          >
            {reportLoading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                {t("assistant.reportStreaming")}
              </>
            ) : (
              t("assistant.runReport")
            )}
          </Button>
          <div className="min-h-[120px] rounded-md border bg-muted/30 p-4 text-sm leading-relaxed whitespace-pre-wrap">
            {reportText || (reportLoading ? "" : "—")}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{t("assistant.chatTitle")}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <Textarea
            value={chatInput}
            onChange={(e) => setChatInput(e.target.value)}
            placeholder={t("assistant.placeholder")}
            rows={3}
            disabled={!projectId || chatLoading}
          />
          <Button
            disabled={!projectId || chatLoading || !chatInput.trim()}
            onClick={() => void sendChat()}
          >
            {chatLoading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                {t("assistant.thinking")}
              </>
            ) : (
              t("assistant.send")
            )}
          </Button>
          {chatError ? (
            <p className="text-sm text-destructive">{chatError}</p>
          ) : null}
          <div className="min-h-[100px] rounded-md border bg-muted/30 p-4 text-sm leading-relaxed whitespace-pre-wrap">
            {chatOut || "—"}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
