import { useEffect, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
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
import { AvopPageHeader } from "@/components/avop";
import { ExplorerProjectSelect } from "@/components/explorer/explorer-project-select";
import { PlatformAnswerSheet } from "@/components/explorer/platform-answer-sheet";
import { useExplorerProjectId } from "@/hooks/use-explorer-project";
import { useEngines } from "@/hooks/use-engines";
import { useProjectAnswerDetail } from "@/hooks/use-project-answer";
import { usePlatformQueries } from "@/hooks/use-project-explorer";

export const Route = createFileRoute("/_dashboard/platforms")({
  component: PlatformsPage,
});

function PlatformsPage() {
  const { t } = useTranslation("explorer");
  const {
    projectId,
    projects,
    isLoadingProjects,
    setPreferredProjectId,
  } = useExplorerProjectId();
  const { data: engines, isLoading: enginesLoading } = useEngines();
  const [engineSlug, setEngineSlug] = useState<string>("");
  const [openAnswerId, setOpenAnswerId] = useState<string | null>(null);
  const [selectedQueryPreview, setSelectedQueryPreview] = useState<
    string | null
  >(null);

  const answerDetail = useProjectAnswerDetail(
    projectId ?? undefined,
    openAnswerId,
  );

  useEffect(() => {
    if (!engines?.length) return;
    if (!engineSlug || !engines.some((e) => e.slug === engineSlug)) {
      setEngineSlug(engines[0]?.slug ?? "");
    }
  }, [engines, engineSlug]);

  const pq = usePlatformQueries(projectId ?? undefined, engineSlug, {});

  return (
    <div className="space-y-8">
      <div>
        <AvopPageHeader
          title={t("platforms.title")}
          description={t("platforms.subtitle")}
        />
      </div>

      {isLoadingProjects ? (
        <Skeleton className="h-10 w-full max-w-md" />
      ) : projects.length === 0 ? (
        <p className="text-sm text-muted-foreground">{t("emptyProjects")}</p>
      ) : (
        <div className="flex flex-col gap-4 sm:flex-row sm:flex-wrap sm:items-center">
          <ExplorerProjectSelect
            projects={projects}
            value={projectId}
            onChange={setPreferredProjectId}
          />
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium">{t("platforms.engine")}</span>
            {enginesLoading ? (
              <Skeleton className="h-10 w-40" />
            ) : (
              <Select value={engineSlug} onValueChange={setEngineSlug}>
                <SelectTrigger className="w-[220px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {(engines ?? []).map((e) => (
                    <SelectItem key={e.id} value={e.slug}>
                      {e.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </div>
        </div>
      )}

      <Card>
        <CardHeader>
          <CardTitle>{pq.data?.engine ?? engineSlug}</CardTitle>
          <CardDescription>
            {t("platforms.subtitle")}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {pq.isLoading ? (
            <div className="space-y-2">
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-10 w-full" />
            </div>
          ) : pq.error ? (
            <p className="text-sm text-destructive">
              {(pq.error as Error).message}
            </p>
          ) : !projectId || !engineSlug ? (
            <p className="text-sm text-muted-foreground">{t("emptyProjects")}</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t("platforms.query")}</TableHead>
                  <TableHead className="text-right">{t("platforms.rank")}</TableHead>
                  <TableHead className="text-right">
                    {t("platforms.citations")}
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {(pq.data?.queries ?? []).map((row) => (
                  <TableRow
                    key={row.answer_id}
                    className="cursor-pointer hover:bg-muted/50"
                    onClick={() => {
                      setOpenAnswerId(row.answer_id);
                      setSelectedQueryPreview(row.query_text);
                    }}
                  >
                    <TableCell className="max-w-lg">{row.query_text}</TableCell>
                    <TableCell className="text-right">{row.rank}</TableCell>
                    <TableCell className="text-right">
                      {row.citation_count}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <PlatformAnswerSheet
        open={openAnswerId !== null}
        onOpenChange={(o) => {
          if (!o) {
            setOpenAnswerId(null);
            setSelectedQueryPreview(null);
          }
        }}
        engine={answerDetail.data?.engine ?? pq.data?.engine ?? null}
        queryText={
          answerDetail.data?.query_text ?? selectedQueryPreview ?? null
        }
        rawText={answerDetail.data?.raw_text ?? null}
        brandMentions={answerDetail.data?.brand_mentions}
        isLoading={answerDetail.isLoading}
        error={answerDetail.error as Error | null}
      />
    </div>
  );
}
