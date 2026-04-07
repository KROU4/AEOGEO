import { useState } from "react";
import { useTranslation } from "react-i18next";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import {
  Globe,
  Loader2,
  CheckCircle2,
  AlertCircle,
  Search,
} from "lucide-react";
import { cn } from "@/lib/utils";
import type {
  CrawlJob,
  CrawlKnowledgePreview,
  CrawlStatus,
  KnowledgeEntry,
} from "@/types/brand";

interface StepCrawlWebsiteProps {
  domain: string;
  crawlJob: CrawlJob | null;
  isCrawling: boolean;
  persistedKnowledge: KnowledgeEntry[];
  onStartCrawl: (domain: string, maxPages: number) => void;
}

function previewText(value: string, maxChars = 180): string {
  const compact = value.replace(/\s+/g, " ").trim();
  if (compact.length <= maxChars) {
    return compact;
  }
  return `${compact.slice(0, maxChars - 1).trimEnd()}...`;
}

function StatusIcon({ status }: { status: CrawlStatus }) {
  switch (status) {
    case "crawling":
    case "processing":
      return <Loader2 className="h-5 w-5 animate-spin text-teal-600" />;
    case "completed":
      return <CheckCircle2 className="h-5 w-5 text-green-600" />;
    case "error":
      return <AlertCircle className="h-5 w-5 text-destructive" />;
    default:
      return <Globe className="h-5 w-5 text-muted-foreground" />;
  }
}

function StatusLabel({ status, t }: { status: CrawlStatus; t: (key: string) => string }) {
  const map: Record<CrawlStatus, string> = {
    idle: t("crawlWebsite.statusIdle"),
    crawling: t("crawlWebsite.statusCrawling"),
    processing: t("crawlWebsite.statusProcessing"),
    completed: t("crawlWebsite.statusCompleted"),
    error: t("crawlWebsite.statusError"),
  };
  return <span>{map[status]}</span>;
}

export function StepCrawlWebsite({
  domain,
  crawlJob,
  isCrawling,
  persistedKnowledge,
  onStartCrawl,
}: StepCrawlWebsiteProps) {
  const { t } = useTranslation("onboarding");
  const [crawlDomain, setCrawlDomain] = useState(domain || "");
  const [maxPages, setMaxPages] = useState(50);

  const status: CrawlStatus = crawlJob?.status ?? "idle";
  const isActive = status === "crawling" || status === "processing";
  const progress =
    crawlJob && crawlJob.pages_found > 0
      ? Math.round((crawlJob.pages_crawled / crawlJob.pages_found) * 100)
      : 0;
  const liveKnowledge = crawlJob?.knowledge_entries ?? [];
  const knowledgePreview: Array<CrawlKnowledgePreview | KnowledgeEntry> =
    liveKnowledge.length > 0 ? liveKnowledge : persistedKnowledge.slice(0, 12);

  function handleStart() {
    if (!crawlDomain.trim()) return;
    onStartCrawl(crawlDomain.trim(), maxPages);
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t("crawlWebsite.title")}</CardTitle>
        <CardDescription>{t("crawlWebsite.description")}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Domain + Max Pages */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="md:col-span-2 space-y-2">
            <Label htmlFor="crawl-domain">{t("crawlWebsite.domainLabel")}</Label>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                id="crawl-domain"
                value={crawlDomain}
                onChange={(e) => setCrawlDomain(e.target.value)}
                placeholder={t("crawlWebsite.domainPlaceholder")}
                disabled={isActive}
                className="pl-9"
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="max-pages">{t("crawlWebsite.maxPagesLabel")}</Label>
            <Input
              id="max-pages"
              type="number"
              min={1}
              max={500}
              value={maxPages}
              onChange={(e) => setMaxPages(Number(e.target.value))}
              disabled={isActive}
            />
          </div>
        </div>

        {/* Start button */}
        <Button
          onClick={handleStart}
          disabled={isActive || isCrawling || !crawlDomain.trim()}
          className="w-full sm:w-auto"
        >
          {isActive ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              {t("crawlWebsite.crawling")}
            </>
          ) : (
            <>
              <Globe className="h-4 w-4" />
              {t("crawlWebsite.startCrawl")}
            </>
          )}
        </Button>

        {/* Status panel */}
        {crawlJob && (
          <div
            className={cn(
              "rounded-lg border p-4 space-y-4",
              status === "completed" && "border-green-200 bg-green-50 dark:border-green-900 dark:bg-green-950",
              status === "error" && "border-destructive/30 bg-destructive/5",
              isActive && "border-teal-200 bg-teal-50 dark:border-teal-900 dark:bg-teal-950"
            )}
          >
            {/* Status header */}
            <div className="flex items-center gap-3">
              <StatusIcon status={status} />
              <div className="flex-1">
                <p className="text-sm font-medium">
                  <StatusLabel status={status} t={t} />
                </p>
                {isActive && crawlJob.pages_found > 0 && (
                  <p className="text-xs text-muted-foreground">
                    {t("crawlWebsite.progressLabel", {
                      crawled: crawlJob.pages_crawled,
                      found: crawlJob.pages_found,
                    })}
                  </p>
                )}
              </div>
            </div>

            {/* Progress bar */}
            {isActive && (
              <Progress value={progress} className="h-2" />
            )}

            {/* Stats */}
            {(status === "completed" || isActive) && (
              <div className="grid grid-cols-3 gap-4 text-center">
                <div>
                  <p className="text-2xl font-bold text-foreground">
                    {crawlJob.pages_found}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {t("crawlWebsite.pagesFound")}
                  </p>
                </div>
                <div>
                  <p className="text-2xl font-bold text-foreground">
                    {crawlJob.pages_crawled}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {t("crawlWebsite.pagesCrawled")}
                  </p>
                </div>
                <div>
                  <p className="text-2xl font-bold text-teal-700 dark:text-teal-400">
                    {crawlJob.entries_created}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {t("crawlWebsite.entriesCreated")}
                  </p>
                </div>
              </div>
            )}

            {/* No entries warning */}
            {status === "completed" && crawlJob.entries_created === 0 && crawlJob.pages_crawled > 0 && (
              <p className="text-sm text-amber-700 dark:text-amber-400">
                {t("crawlWebsite.noEntriesExtracted")}
              </p>
            )}

            {/* Error message */}
            {status === "error" && crawlJob.error_message && (
              <p className="text-sm text-destructive">{crawlJob.error_message}</p>
            )}
          </div>
        )}

        {crawlJob?.pages.length ? (
          <div className="space-y-3">
            <div>
              <h4 className="text-sm font-medium text-foreground">
                {t("crawlWebsite.pagesPreviewTitle")}
              </h4>
              <p className="text-sm text-muted-foreground">
                {t("crawlWebsite.pagesPreviewDescription")}
              </p>
            </div>
            <div className="space-y-3">
              {crawlJob.pages.map((page) => (
                <div
                  key={`${page.url}:${page.status}`}
                  className="rounded-lg border border-border p-4"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0 space-y-1">
                      <p className="text-sm font-medium text-foreground">
                        {page.title || page.url}
                      </p>
                      <a
                        href={page.url}
                        target="_blank"
                        rel="noreferrer"
                        className="block truncate text-xs text-teal-700 underline underline-offset-4"
                      >
                        {page.url}
                      </a>
                    </div>
                    <Badge variant={page.status === "success" ? "secondary" : "outline"}>
                      {page.status === "success"
                        ? t("crawlWebsite.pageStatusSuccess")
                        : t("crawlWebsite.pageStatusFailed")}
                    </Badge>
                  </div>
                  {page.content_preview && (
                    <p className="mt-3 text-sm text-muted-foreground">
                      {page.content_preview}
                    </p>
                  )}
                  {page.error_message && (
                    <p className="mt-3 text-sm text-destructive">
                      {page.error_message}
                    </p>
                  )}
                </div>
              ))}
            </div>
          </div>
        ) : null}

        {knowledgePreview.length > 0 && (
          <div className="space-y-3">
            <div>
              <h4 className="text-sm font-medium text-foreground">
                {t("crawlWebsite.knowledgePreviewTitle")}
              </h4>
              <p className="text-sm text-muted-foreground">
                {t("crawlWebsite.knowledgePreviewDescription")}
              </p>
            </div>
            <div className="space-y-3">
              {knowledgePreview.map((entry, index) => (
                <div
                  key={`${entry.source_url ?? "entry"}:${entry.type}:${index}`}
                  className="rounded-lg border border-border p-4"
                >
                  <div className="flex items-center gap-2">
                    <Badge variant="outline">{entry.type}</Badge>
                    {entry.source_url && (
                      <a
                        href={entry.source_url}
                        target="_blank"
                        rel="noreferrer"
                        className="truncate text-xs text-teal-700 underline underline-offset-4"
                      >
                        {entry.source_url}
                      </a>
                    )}
                  </div>
                  <p className="mt-3 text-sm text-muted-foreground">
                    {previewText(entry.content)}
                  </p>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Skip hint */}
        <p className="text-sm text-muted-foreground">
          {t("crawlWebsite.skipHint")}
        </p>
      </CardContent>
    </Card>
  );
}
