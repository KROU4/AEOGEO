import { useTranslation } from "react-i18next";
import { ApiError } from "@/lib/api-client";
import { formatDate } from "@/lib/format";
import { useLocale } from "@/hooks/use-locale";
import { useCitationDomainDetail } from "@/hooks/use-project-explorer";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";

interface CitationDomainDetailSheetProps {
  projectId: string;
  domain: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function CitationDomainDetailSheet({
  projectId,
  domain,
  open,
  onOpenChange,
}: CitationDomainDetailSheetProps) {
  const { t } = useTranslation("explorer");
  const { locale } = useLocale();
  const detail = useCitationDomainDetail(projectId, domain, { enabled: open });

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="flex w-full flex-col sm:max-w-lg">
        <SheetHeader>
          <SheetTitle>
            {domain ? t("citations.detailTitle", { domain }) : ""}
          </SheetTitle>
          <SheetDescription>{t("citations.detailSubtitle")}</SheetDescription>
        </SheetHeader>

        <div className="min-h-0 flex-1 px-4 pb-4">
          {detail.isLoading ? (
            <div className="space-y-3">
              <Skeleton className="h-24 w-full" />
              <Skeleton className="h-24 w-full" />
            </div>
          ) : detail.error ? (
            <p className="text-sm text-destructive">
              {detail.error instanceof ApiError && detail.error.status === 404
                ? t("citations.detailNotFound")
                : t("citations.detailError")}
            </p>
          ) : detail.data && detail.data.all_queries.length > 0 ? (
            <ScrollArea className="h-[calc(100vh-8rem)] pr-3">
              <ul className="space-y-4">
                {detail.data.all_queries.map((q, i) => (
                  <li key={`${q.query}-${q.engine}-${i}`}>
                    {i > 0 ? <Separator className="mb-4" /> : null}
                    <div className="space-y-2">
                      <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                        <span className="font-medium text-foreground">{q.engine}</span>
                        {q.cited_at ? (
                          <span>
                            {t("citations.detailCitedAt", {
                              date: formatDate(q.cited_at, locale),
                            })}
                          </span>
                        ) : null}
                      </div>
                      <p className="text-sm font-medium text-foreground">{q.query}</p>
                      <p className="text-sm leading-relaxed text-muted-foreground whitespace-pre-wrap">
                        {q.ai_response_excerpt || "—"}
                      </p>
                    </div>
                  </li>
                ))}
              </ul>
            </ScrollArea>
          ) : (
            <p className="text-sm text-muted-foreground">{t("citations.detailEmpty")}</p>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}
