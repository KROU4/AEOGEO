import { useEffect, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import { ChevronLeft, ChevronRight } from "lucide-react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { AvopPageHeader } from "@/components/avop";
import { CitationDomainDetailSheet } from "@/components/explorer/citation-domain-detail-sheet";
import { CitationTrendMini } from "@/components/explorer/citation-trend-mini";
import { ExplorerProjectSelect } from "@/components/explorer/explorer-project-select";
import { useExplorerProjectId } from "@/hooks/use-explorer-project";
import { useEngines } from "@/hooks/use-engines";
import { useProjectCitations } from "@/hooks/use-project-explorer";
import { formatDate } from "@/lib/format";
import { useLocale } from "@/hooks/use-locale";

const PAGE_SIZE = 50;

export const Route = createFileRoute("/_dashboard/citations")({
  component: CitationsPage,
});

function CitationsPage() {
  const { t } = useTranslation("explorer");
  const { locale } = useLocale();
  const { data: engines = [], isLoading: enginesLoading } = useEngines();
  const {
    projectId,
    projects,
    isLoadingProjects,
    setPreferredProjectId,
  } = useExplorerProjectId();

  const [engineFilter, setEngineFilter] = useState("all");
  const [domainDraft, setDomainDraft] = useState("");
  const [domainFilter, setDomainFilter] = useState("");
  const [page, setPage] = useState(1);
  const [detailDomain, setDetailDomain] = useState<string | null>(null);

  useEffect(() => {
    setPage(1);
  }, [engineFilter, domainFilter, projectId]);

  const q = useProjectCitations(projectId ?? undefined, {
    engine: engineFilter,
    domain: domainFilter || undefined,
    page,
    limit: PAGE_SIZE,
  });

  const total = q.data?.total ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  useEffect(() => {
    if (page > totalPages) setPage(totalPages);
  }, [page, totalPages]);

  const applyDomain = () => {
    setDomainFilter(domainDraft.trim());
  };

  const clearDomain = () => {
    setDomainDraft("");
    setDomainFilter("");
  };

  return (
    <div className="space-y-8">
      <div>
        <AvopPageHeader
          title={t("citations.title")}
          description={t("citations.subtitle")}
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

      {projectId ? (
        <div className="flex flex-col gap-4 rounded-lg border border-border bg-card/40 p-4 md:flex-row md:flex-wrap md:items-end">
          <div className="space-y-2 min-w-[200px]">
            <Label htmlFor="citations-engine">{t("citations.filterEngine")}</Label>
            <Select
              value={engineFilter}
              onValueChange={setEngineFilter}
              disabled={enginesLoading}
            >
              <SelectTrigger id="citations-engine" className="w-full md:w-[220px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{t("citations.engineAll")}</SelectItem>
                {engines.map((e) => (
                  <SelectItem key={e.id} value={e.slug}>
                    {e.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="flex min-w-0 flex-1 flex-col gap-2 sm:flex-row sm:items-end">
            <div className="min-w-0 flex-1 space-y-2">
              <Label htmlFor="citations-domain">{t("citations.filterDomain")}</Label>
              <Input
                id="citations-domain"
                placeholder={t("citations.domainPlaceholder")}
                value={domainDraft}
                onChange={(e) => setDomainDraft(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") applyDomain();
                }}
              />
            </div>
            <div className="flex gap-2">
              <Button type="button" variant="secondary" onClick={applyDomain}>
                {t("citations.apply")}
              </Button>
              <Button
                type="button"
                variant="ghost"
                onClick={clearDomain}
                disabled={!domainDraft && !domainFilter}
              >
                {t("citations.clear")}
              </Button>
            </div>
          </div>
        </div>
      ) : null}

      <Card>
        <CardHeader>
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <CardTitle>{t("citations.tableTitle")}</CardTitle>
              <CardDescription>
                {q.data?.updated_at
                  ? t("citations.updated", {
                      time: formatDate(q.data.updated_at, locale, {
                        dateStyle: "medium",
                        timeStyle: "short",
                      }),
                    })
                  : null}
                {total > 0 ? (
                  <span className="ml-2 text-muted-foreground">
                    {t("citations.totalRows", { count: total })}
                  </span>
                ) : null}
              </CardDescription>
            </div>
            {projectId && totalPages > 1 ? (
              <div className="flex items-center gap-2">
                <span className="text-xs text-muted-foreground tabular-nums">
                  {t("citations.pageOf", { page, total: totalPages })}
                </span>
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  className="h-8 w-8"
                  disabled={page <= 1 || q.isLoading}
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  aria-label={t("citations.prev")}
                >
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  className="h-8 w-8"
                  disabled={page >= totalPages || q.isLoading}
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                  aria-label={t("citations.next")}
                >
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            ) : null}
          </div>
        </CardHeader>
        <CardContent>
          {q.isLoading ? (
            <div className="space-y-2">
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-10 w-full" />
            </div>
          ) : q.error ? (
            <p className="text-sm text-destructive">
              {(q.error as Error).message}
            </p>
          ) : !projectId ? (
            <p className="text-sm text-muted-foreground">{t("emptyProjects")}</p>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{t("citations.domain")}</TableHead>
                    <TableHead>{t("citations.engine")}</TableHead>
                    <TableHead className="text-right">{t("citations.cites")}</TableHead>
                    <TableHead className="w-[100px] text-right">
                      {t("citations.trend")}
                    </TableHead>
                    <TableHead>{t("citations.firstSeen")}</TableHead>
                    <TableHead>{t("citations.query")}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {(q.data?.citations ?? []).map((row, i) => (
                    <TableRow
                      key={`${row.domain}-${row.engine}-${i}`}
                      className="cursor-pointer hover:bg-muted/60"
                      onClick={() => setDetailDomain(row.domain)}
                    >
                      <TableCell className="font-medium">
                        <span className="flex flex-wrap items-center gap-2">
                          {row.domain}
                          {row.is_client_domain ? (
                            <Badge variant="secondary" className="text-[10px]">
                              {t("citations.you")}
                            </Badge>
                          ) : null}
                        </span>
                      </TableCell>
                      <TableCell>{row.engine}</TableCell>
                      <TableCell className="text-right tabular-nums">
                        {row.times_cited}
                      </TableCell>
                      <TableCell className="text-right">
                        <CitationTrendMini values={row.trend} />
                      </TableCell>
                      <TableCell className="whitespace-nowrap text-muted-foreground text-sm">
                        {row.first_seen
                          ? formatDate(row.first_seen, locale)
                          : "—"}
                      </TableCell>
                      <TableCell className="max-w-[min(28rem,55vw)] truncate text-muted-foreground">
                        {row.query_preview ?? "—"}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
              {total === 0 && !q.isLoading ? (
                <p className="py-8 text-center text-sm text-muted-foreground">
                  {t("citations.empty")}
                </p>
              ) : null}
            </div>
          )}
        </CardContent>
      </Card>

      {projectId ? (
        <CitationDomainDetailSheet
          projectId={projectId}
          domain={detailDomain}
          open={detailDomain != null}
          onOpenChange={(open) => {
            if (!open) setDetailDomain(null);
          }}
        />
      ) : null}
    </div>
  );
}
