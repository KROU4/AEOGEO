import { useTranslation } from "react-i18next";
import {
  BookOpen,
  Building2,
  ExternalLink,
  FileText,
  FolderOpen,
  Package,
  Pencil,
  Sparkles,
  Swords,
} from "lucide-react";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Skeleton } from "@/components/ui/skeleton";
import {
  useBrand,
  useCompetitors,
  useKnowledgeEntries,
  useProducts,
  useProjectFiles,
} from "@/hooks/use-brand";
import { useLocale } from "@/hooks/use-locale";
import { ApiError } from "@/lib/api-client";
import { formatDate } from "@/lib/format";
import type { Project } from "@/types/api";

interface KnowledgePackDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  project: Project | null;
  onEditKnowledge?: () => void;
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024) {
    return `${bytes} B`;
  }
  if (bytes < 1024 * 1024) {
    return `${(bytes / 1024).toFixed(1)} KB`;
  }
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function getEntryTypeLabel(value: string): string {
  return value
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

export function KnowledgePackDialog({
  open,
  onOpenChange,
  project,
  onEditKnowledge,
}: KnowledgePackDialogProps) {
  const { t } = useTranslation("projects");
  const { locale } = useLocale();
  const projectId = project?.id ?? "";
  const { data: brand, isLoading: brandLoading, error: brandError } = useBrand(projectId);
  const {
    data: entriesData,
    isLoading: entriesLoading,
    error: entriesError,
  } = useKnowledgeEntries(projectId);
  const {
    data: files = [],
    isLoading: filesLoading,
    error: filesError,
  } = useProjectFiles(projectId);
  const { data: products = [], isLoading: productsLoading } = useProducts(projectId);
  const { data: competitors = [], isLoading: competitorsLoading } = useCompetitors(projectId);

  const entries = entriesData?.items ?? [];

  const brandMissing =
    brandError instanceof ApiError && brandError.status === 404;
  const blockingError =
    !brandMissing &&
    ((brandError instanceof ApiError && brandError.status !== 404) ||
      entriesError ||
      filesError);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent showCloseButton={false} className="flex max-w-[calc(100%-2rem)] flex-col gap-0 overflow-hidden p-0 sm:max-w-4xl" style={{ maxHeight: "90vh", top: "50%", left: "50%", translate: "-50% -50%" }}>
        <div className="border-b border-border bg-muted/30 px-6 py-5">
          <DialogHeader>
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <DialogTitle className="flex items-center gap-2">
                    <BookOpen className="h-5 w-5 text-teal-600" />
                    {t("knowledge.title")}
                  </DialogTitle>
                  {project && (
                    <Badge
                      variant="outline"
                      className="border-teal-200 bg-teal-50 text-teal-700"
                    >
                      {project.name}
                    </Badge>
                  )}
                </div>
                <DialogDescription>
                  {t("knowledge.description")}
                </DialogDescription>
              </div>

              {!brandMissing && (
                <div className="flex flex-wrap items-center gap-2">
                  <Badge variant="outline">
                    {t("knowledge.productCount", { count: products.length })}
                  </Badge>
                  <Badge variant="outline">
                    {t("knowledge.competitorCount", { count: competitors.length })}
                  </Badge>
                  <Badge variant="outline">
                    {t("knowledge.entryCount", { count: entries.length })}
                  </Badge>
                  <Badge variant="outline">
                    {t("knowledge.fileCount", { count: files.length })}
                  </Badge>
                </div>
              )}
            </div>
          </DialogHeader>
        </div>

        {brandMissing ? (
          <div className="px-6 py-8">
            <Card className="border-dashed">
              <CardContent className="flex flex-col items-start gap-4 py-8">
                <div className="flex h-12 w-12 items-center justify-center rounded-full bg-teal-50 text-teal-700">
                  <Sparkles className="h-5 w-5" />
                </div>
                <div className="space-y-2">
                  <h3 className="text-lg font-semibold text-foreground">
                    {t("knowledge.createPackTitle")}
                  </h3>
                  <p className="max-w-2xl text-sm text-muted-foreground">
                    {t("knowledge.createPackDescription")}
                  </p>
                </div>
                {onEditKnowledge && (
                  <Button onClick={onEditKnowledge}>
                    <Sparkles className="h-4 w-4" />
                    {t("knowledge.createPackAction")}
                  </Button>
                )}
              </CardContent>
            </Card>
          </div>
        ) : blockingError ? (
          <div className="px-6 py-10 text-sm text-destructive">
            {t("knowledge.loadError")}
          </div>
        ) : (
          <ScrollArea className="min-h-0 flex-1" style={{ maxHeight: "calc(90vh - 180px)" }}>
            <div className="p-6">
              <Accordion
                type="multiple"
                defaultValue={["brand", "products", "competitors", "entries", "files"]}
                className="w-full"
              >
                {/* Brand Profile */}
                <AccordionItem value="brand">
                  <AccordionTrigger>
                    <div className="flex items-center gap-2">
                      <Building2 className="h-4 w-4 text-teal-600" />
                      <span>{t("knowledge.brandSectionTitle")}</span>
                      {brand && (
                        <Badge variant="outline" className="text-xs">
                          {brand.name}
                        </Badge>
                      )}
                    </div>
                  </AccordionTrigger>
                  <AccordionContent>
                    {brandLoading ? (
                      <div className="space-y-2">
                        <Skeleton className="h-4 w-full" />
                        <Skeleton className="h-4 w-3/4" />
                      </div>
                    ) : brand ? (
                      <div className="space-y-3">
                        <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-2 text-sm">
                          {brand.description && (
                            <>
                              <dt className="pt-0.5 text-xs font-medium uppercase text-muted-foreground">
                                {t("knowledge.brandFields.description")}
                              </dt>
                              <dd className="line-clamp-3 text-foreground">
                                {brand.description}
                              </dd>
                            </>
                          )}
                          {brand.positioning && (
                            <>
                              <dt className="pt-0.5 text-xs font-medium uppercase text-muted-foreground">
                                {t("knowledge.brandFields.positioning")}
                              </dt>
                              <dd className="line-clamp-2 text-foreground">
                                {brand.positioning}
                              </dd>
                            </>
                          )}
                          {brand.website && (
                            <>
                              <dt className="pt-0.5 text-xs font-medium uppercase text-muted-foreground">
                                {t("knowledge.brandFields.website")}
                              </dt>
                              <dd>
                                <a
                                  href={brand.website}
                                  target="_blank"
                                  rel="noreferrer"
                                  className="inline-flex items-center gap-1 text-sm text-teal-700 hover:underline"
                                >
                                  <ExternalLink className="h-3 w-3" />
                                  {brand.website}
                                </a>
                              </dd>
                            </>
                          )}
                          {brand.voice_guidelines && (
                            <>
                              <dt className="pt-0.5 text-xs font-medium uppercase text-muted-foreground">
                                {t("knowledge.brandFields.voiceGuidelines")}
                              </dt>
                              <dd className="line-clamp-2 text-foreground">
                                {brand.voice_guidelines}
                              </dd>
                            </>
                          )}
                        </dl>
                        {brand.allowed_phrases && brand.allowed_phrases.length > 0 && (
                          <div className="space-y-1">
                            <span className="text-xs font-medium uppercase text-muted-foreground">
                              {t("knowledge.brandFields.allowedPhrases")}
                            </span>
                            <div className="flex flex-wrap gap-1.5">
                              {brand.allowed_phrases.map((phrase, i) => (
                                <Badge key={i} variant="secondary" className="text-xs">
                                  {phrase}
                                </Badge>
                              ))}
                            </div>
                          </div>
                        )}
                        {brand.forbidden_phrases && brand.forbidden_phrases.length > 0 && (
                          <div className="space-y-1">
                            <span className="text-xs font-medium uppercase text-muted-foreground">
                              {t("knowledge.brandFields.forbiddenPhrases")}
                            </span>
                            <div className="flex flex-wrap gap-1.5">
                              {brand.forbidden_phrases.map((phrase, i) => (
                                <Badge
                                  key={i}
                                  variant="outline"
                                  className="border-red-200 bg-red-50 text-xs text-red-700"
                                >
                                  {phrase}
                                </Badge>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    ) : (
                      <p className="text-sm text-muted-foreground">
                        {t("knowledge.brandEmpty")}
                      </p>
                    )}
                  </AccordionContent>
                </AccordionItem>

                {/* Products */}
                <AccordionItem value="products">
                  <AccordionTrigger>
                    <div className="flex items-center gap-2">
                      <Package className="h-4 w-4 text-teal-600" />
                      <span>{t("knowledge.productsSectionTitle")}</span>
                      <Badge variant="outline" className="text-xs">
                        {products.length}
                      </Badge>
                    </div>
                  </AccordionTrigger>
                  <AccordionContent>
                    {productsLoading ? (
                      <div className="space-y-2">
                        <Skeleton className="h-12 w-full" />
                        <Skeleton className="h-12 w-full" />
                      </div>
                    ) : products.length === 0 ? (
                      <p className="text-sm text-muted-foreground">
                        {t("knowledge.productsEmpty")}
                      </p>
                    ) : (
                      <div className="space-y-2">
                        {products.map((product) => (
                          <div
                            key={product.id}
                            className="rounded-lg border border-border/50 px-3 py-2.5"
                          >
                            <div className="flex flex-wrap items-center gap-2">
                              <span className="text-sm font-medium text-foreground">
                                {product.name}
                              </span>
                              {product.category && (
                                <Badge variant="outline" className="text-xs">
                                  {product.category}
                                </Badge>
                              )}
                              {product.pricing && (
                                <span className="text-xs text-muted-foreground">
                                  {product.pricing}
                                </span>
                              )}
                            </div>
                            {product.description && (
                              <p className="mt-0.5 line-clamp-1 text-xs text-muted-foreground">
                                {product.description}
                              </p>
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                  </AccordionContent>
                </AccordionItem>

                {/* Competitors */}
                <AccordionItem value="competitors">
                  <AccordionTrigger>
                    <div className="flex items-center gap-2">
                      <Swords className="h-4 w-4 text-teal-600" />
                      <span>{t("knowledge.competitorsSectionTitle")}</span>
                      <Badge variant="outline" className="text-xs">
                        {competitors.length}
                      </Badge>
                    </div>
                  </AccordionTrigger>
                  <AccordionContent>
                    {competitorsLoading ? (
                      <div className="space-y-2">
                        <Skeleton className="h-12 w-full" />
                        <Skeleton className="h-12 w-full" />
                      </div>
                    ) : competitors.length === 0 ? (
                      <p className="text-sm text-muted-foreground">
                        {t("knowledge.competitorsEmpty")}
                      </p>
                    ) : (
                      <div className="space-y-2">
                        {competitors.map((competitor) => (
                          <div
                            key={competitor.id}
                            className="rounded-lg border border-border/50 px-3 py-2.5"
                          >
                            <div className="flex flex-wrap items-center gap-2">
                              <span className="text-sm font-medium text-foreground">
                                {competitor.name}
                              </span>
                              {competitor.website && (
                                <a
                                  href={competitor.website}
                                  target="_blank"
                                  rel="noreferrer"
                                  className="inline-flex items-center gap-1 text-xs text-teal-700 hover:underline"
                                >
                                  <ExternalLink className="h-3 w-3" />
                                  {competitor.website}
                                </a>
                              )}
                            </div>
                            {competitor.positioning && (
                              <p className="mt-0.5 line-clamp-1 text-xs text-muted-foreground">
                                {competitor.positioning}
                              </p>
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                  </AccordionContent>
                </AccordionItem>

                {/* Knowledge Entries */}
                <AccordionItem value="entries">
                  <AccordionTrigger>
                    <div className="flex items-center gap-2">
                      <BookOpen className="h-4 w-4 text-teal-600" />
                      <span>{t("knowledge.entriesTitle")}</span>
                      <Badge variant="outline" className="text-xs">
                        {entries.length}
                      </Badge>
                    </div>
                  </AccordionTrigger>
                  <AccordionContent>
                    <div className="space-y-4">
                      {entriesLoading && (
                        <>
                          <Skeleton className="h-28 w-full" />
                          <Skeleton className="h-28 w-full" />
                        </>
                      )}

                      {!entriesLoading && entries.length === 0 && (
                        <Card className="border-dashed">
                          <CardContent className="flex flex-col items-center gap-3 py-8 text-center">
                            <div className="flex h-11 w-11 items-center justify-center rounded-full bg-muted">
                              <FolderOpen className="h-5 w-5 text-muted-foreground" />
                            </div>
                            <div className="space-y-1">
                              <h4 className="font-medium text-foreground">
                                {t("knowledge.emptyTitle")}
                              </h4>
                              <p className="max-w-sm text-sm text-muted-foreground">
                                {t("knowledge.emptyDescription")}
                              </p>
                            </div>
                          </CardContent>
                        </Card>
                      )}

                      {entries.map((entry) => (
                        <Card key={entry.id} className="border-border/70">
                          <CardContent className="space-y-4 pt-5">
                            <div className="space-y-2">
                              <div className="flex flex-wrap items-center gap-2">
                                <Badge variant="outline">
                                  {getEntryTypeLabel(entry.type)}
                                </Badge>
                                <Badge variant="outline">
                                  {t("knowledge.versionLabel", { version: entry.version })}
                                </Badge>
                                {entry.has_embedding && (
                                  <Badge
                                    variant="outline"
                                    className="border-emerald-200 bg-emerald-50 text-emerald-700"
                                  >
                                    {t("knowledge.embeddingReady")}
                                  </Badge>
                                )}
                              </div>
                              <p className="text-sm leading-6 text-foreground">
                                {entry.content}
                              </p>
                            </div>

                            <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
                              <span>
                                {formatDate(entry.updated_at ?? entry.created_at, locale)}
                              </span>
                              {entry.source_url && (
                                <a
                                  href={entry.source_url}
                                  target="_blank"
                                  rel="noreferrer"
                                  className="inline-flex items-center gap-1 text-teal-700 hover:underline"
                                >
                                  <ExternalLink className="h-3 w-3" />
                                  {entry.source_url}
                                </a>
                              )}
                            </div>
                          </CardContent>
                        </Card>
                      ))}
                    </div>
                  </AccordionContent>
                </AccordionItem>

                {/* Source Files */}
                <AccordionItem value="files" className="border-b-0">
                  <AccordionTrigger>
                    <div className="flex items-center gap-2">
                      <FileText className="h-4 w-4 text-teal-600" />
                      <span>{t("knowledge.filesTitle")}</span>
                      <Badge variant="outline" className="text-xs">
                        {files.length}
                      </Badge>
                    </div>
                  </AccordionTrigger>
                  <AccordionContent>
                    {filesLoading ? (
                      <div className="space-y-2">
                        <Skeleton className="h-16 w-full" />
                        <Skeleton className="h-16 w-full" />
                      </div>
                    ) : files.length === 0 ? (
                      <div className="rounded-lg border border-dashed border-border px-4 py-6 text-sm text-muted-foreground">
                        {t("knowledge.filesEmpty")}
                      </div>
                    ) : (
                      <div className="space-y-3">
                        {files.map((file) => (
                          <div
                            key={file.id}
                            className="rounded-lg border border-border/70 px-4 py-3"
                          >
                            <div className="flex items-center gap-2">
                              <FileText className="h-4 w-4 text-muted-foreground" />
                              <p className="truncate text-sm font-medium text-foreground">
                                {file.filename}
                              </p>
                            </div>
                            <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                              <span>{file.file_type.toUpperCase()}</span>
                              <span>{formatFileSize(file.file_size)}</span>
                              <span>{formatDate(file.created_at, locale)}</span>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </AccordionContent>
                </AccordionItem>
              </Accordion>
            </div>
          </ScrollArea>
        )}

        <DialogFooter className="border-t border-border px-6 py-4">
          <div className="flex w-full items-center justify-between">
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              {t("knowledge.close")}
            </Button>
            {onEditKnowledge && (
              <Button onClick={onEditKnowledge}>
                <Pencil className="h-4 w-4" />
                {t("knowledge.editKnowledgeBase")}
              </Button>
            )}
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
