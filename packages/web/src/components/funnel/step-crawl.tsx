import { useEffect, useRef } from "react";
import { useTranslation } from "react-i18next";
import {
  Loader2,
  CheckCircle2,
  ArrowLeft,
  Globe,
  XCircle,
  Sparkles,
} from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { useProject } from "@/hooks/use-projects";
import { useKnowledgeEntries } from "@/hooks/use-brand";
import {
  useCrawlStream,
  type CrawlPage,
  type CrawlPhase,
} from "@/hooks/use-crawl-stream";

interface StepCrawlProps {
  projectId: string;
  onContinue: () => void;
  onBack: () => void;
}

function computeProgress(
  phase: CrawlPhase,
  pagesDone: number,
  pagesTotal: number,
  extractionDone: number,
  extractionTotal: number,
): number {
  if (phase === "idle" || phase === "connecting") return 2;
  // Crawling = 0-50%, Extraction = 50-90%, Embedding = 90-100%
  const crawl =
    pagesTotal > 0 ? (pagesDone / pagesTotal) * 50 : phase === "crawling" ? 5 : 50;
  const extract =
    extractionTotal > 0 ? (extractionDone / extractionTotal) * 40 : 0;
  const embed = phase === "complete" ? 10 : phase === "embedding" ? 5 : 0;
  return Math.min(Math.round(crawl + extract + embed), 100);
}

function PhaseStatus({ phase, t }: { phase: CrawlPhase; t: (k: string) => string }) {
  switch (phase) {
    case "connecting":
      return (
        <div className="flex items-center justify-center gap-2 text-muted-foreground">
          <Globe className="h-5 w-5 animate-pulse" />
          <span>{t("crawl.connecting")}</span>
        </div>
      );
    case "crawling":
      return (
        <div className="flex items-center justify-center gap-2 text-teal-600">
          <Loader2 className="h-5 w-5 animate-spin" />
          <span>{t("crawl.crawling")}</span>
        </div>
      );
    case "extracting":
      return (
        <div className="flex items-center justify-center gap-2 text-teal-600">
          <Sparkles className="h-5 w-5 animate-pulse" />
          <span>{t("crawl.extracting")}</span>
        </div>
      );
    case "embedding":
      return (
        <div className="flex items-center justify-center gap-2 text-teal-600">
          <Loader2 className="h-5 w-5 animate-spin" />
          <span>{t("crawl.embedding")}</span>
        </div>
      );
    case "complete":
      return (
        <div className="flex items-center justify-center gap-2 text-primary">
          <CheckCircle2 className="h-5 w-5" />
          <span className="font-medium">{t("crawl.complete")}</span>
        </div>
      );
    case "error":
      return (
        <div className="flex items-center justify-center gap-2 text-destructive">
          <XCircle className="h-5 w-5" />
          <span>{t("crawl.failed")}</span>
        </div>
      );
    default:
      return null;
  }
}

function PageCard({ page }: { page: CrawlPage }) {
  return (
    <div className="flex items-center gap-2 rounded-md border px-3 py-2 text-sm animate-in fade-in slide-in-from-bottom-1 duration-300">
      {page.status === "success" ? (
        <CheckCircle2 className="h-4 w-4 shrink-0 text-primary" />
      ) : (
        <XCircle className="h-4 w-4 shrink-0 text-destructive" />
      )}
      <div className="min-w-0 flex-1">
        <p className="truncate font-medium">{page.title || page.url}</p>
        <p className="truncate text-xs text-muted-foreground">{page.url}</p>
      </div>
    </div>
  );
}

export function StepCrawl({ projectId, onContinue, onBack }: StepCrawlProps) {
  const { t } = useTranslation("funnel");
  const { data: project } = useProject(projectId);
  const { data: knowledge } = useKnowledgeEntries(projectId);
  const stream = useCrawlStream(projectId);
  const started = useRef(false);

  const existingEntries = knowledge?.items?.length ?? 0;

  useEffect(() => {
    if (started.current || !project?.domain) return;
    // Skip crawl if knowledge entries already exist (user returned to this step)
    if (existingEntries > 0) {
      return;
    }
    started.current = true;
    stream.start(project.domain, 8).catch(() => {
      toast.error("Crawl failed. Please try again.");
    });
  }, [project?.domain, existingEntries]);

  const isDone = stream.phase === "complete" || existingEntries > 0;
  const progress = existingEntries > 0
    ? 100
    : computeProgress(
        stream.phase,
        stream.pagesDone,
        stream.pagesTotal,
        stream.extractionDone,
        stream.extractionTotal,
      );

  return (
    <div className="w-full space-y-8 text-center">
      <div>
        <h1 className="text-2xl font-bold">{t("crawl.heading")}</h1>
        <p className="mt-2 text-muted-foreground">{t("crawl.description")}</p>
      </div>

      <div className="mx-auto max-w-md space-y-4">
        {/* Phase status */}
        {existingEntries > 0 ? (
          <div className="flex items-center justify-center gap-2 text-primary">
            <CheckCircle2 className="h-5 w-5" />
            <span className="font-medium">{t("crawl.complete")}</span>
          </div>
        ) : (
          <PhaseStatus phase={stream.phase} t={t} />
        )}

        {/* Progress bar */}
        {!isDone && <Progress value={progress} className="h-2" />}

        {/* Progress text */}
        {stream.phase === "crawling" && stream.pagesTotal > 0 && (
          <p className="text-sm text-muted-foreground">
            {t("crawl.crawlingProgress", {
              done: stream.pagesDone,
              total: stream.pagesTotal,
            })}
          </p>
        )}
        {stream.phase === "extracting" && stream.extractionTotal > 0 && (
          <p className="text-sm text-muted-foreground">
            {t("crawl.extractingProgress", {
              done: stream.extractionDone,
              total: stream.extractionTotal,
            })}
          </p>
        )}

        {/* Crawled pages */}
        {stream.pages.length > 0 && (
          <div className="max-h-52 space-y-2 overflow-y-auto text-left">
            {stream.pages.map((page) => (
              <PageCard key={page.url} page={page} />
            ))}
          </div>
        )}

        {/* Knowledge entries badges — grouped by type */}
        {stream.entries.length > 0 && (
          <div className="flex flex-wrap gap-1.5 justify-center">
            {Object.entries(
              stream.entries.reduce<Record<string, number>>((acc, e) => {
                acc[e.type] = (acc[e.type] || 0) + 1;
                return acc;
              }, {}),
            ).map(([type, count]) => (
              <Badge key={type} variant="secondary" className="text-xs">
                {type} ({count})
              </Badge>
            ))}
          </div>
        )}

        {/* Summary */}
        {isDone && (
          <p className="text-sm text-muted-foreground">
            {t("crawl.entriesCreated", {
              count: stream.entriesCreated || existingEntries,
            })}
          </p>
        )}

        {/* Error */}
        {stream.phase === "error" && stream.error && (
          <p className="text-sm text-destructive">{stream.error}</p>
        )}
      </div>

      <div className="flex items-center justify-center gap-3">
        <Button variant="outline" onClick={onBack}>
          <ArrowLeft className="mr-2 h-4 w-4" />
          {t("navigation.back")}
        </Button>
        <Button size="lg" onClick={onContinue} disabled={!isDone}>
          {t("navigation.continue")}
        </Button>
      </div>
    </div>
  );
}
