import { useTranslation } from "react-i18next";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Building2,
  Package,
  Swords,
  FileText,
  BookOpen,
  ListChecks,
  Pencil,
  Loader2,
  Rocket,
  CircleAlert,
} from "lucide-react";
import type {
  BrandProfileDraft,
  ProductCreate,
  CompetitorCreate,
  CustomFile,
} from "@/types/brand";
import type { Engine } from "@/types/engine";

interface StepReviewProps {
  brand: BrandProfileDraft;
  products: ProductCreate[];
  competitors: CompetitorCreate[];
  files: CustomFile[];
  knowledgeCount: number;
  activeEngines: Engine[];
  selectedEngineIds: string[];
  sampleCount: number;
  launchAction: "start" | "finish" | null;
  launchError: string | null;
  onToggleEngine: (engineId: string) => void;
  onSampleCountChange: (sampleCount: number) => void;
  onStartFirstRun: () => void;
  onFinishLater: () => void;
  onEditStep: (step: number) => void;
}

function ReviewSection({
  icon: Icon,
  title,
  count,
  countKey,
  onEdit,
  stepNumber,
  children,
}: {
  icon: React.ElementType;
  title: string;
  count?: number;
  countKey?: string;
  onEdit: (step: number) => void;
  stepNumber: number;
  children: React.ReactNode;
}) {
  const { t } = useTranslation("onboarding");

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Icon className="h-4 w-4 text-teal-600" />
          <h3 className="text-sm font-semibold text-foreground">{title}</h3>
          {count !== undefined && countKey ? (
            <Badge variant="secondary" className="text-xs">
              {t(countKey, { count })}
            </Badge>
          ) : null}
        </div>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={() => onEdit(stepNumber)}
          className="text-muted-foreground"
        >
          <Pencil className="h-3 w-3" />
          {t("review.editStep")}
        </Button>
      </div>
      {children}
    </div>
  );
}

export function StepReview({
  brand,
  products,
  competitors,
  files,
  knowledgeCount,
  activeEngines,
  selectedEngineIds,
  sampleCount,
  launchAction,
  launchError,
  onToggleEngine,
  onSampleCountChange,
  onStartFirstRun,
  onFinishLater,
  onEditStep,
}: StepReviewProps) {
  const { t } = useTranslation("onboarding");

  const filteredProducts = products.filter((product) => product.name.trim());
  const filteredCompetitors = competitors.filter((competitor) => competitor.name.trim());
  const isBusy = launchAction !== null;
  const canStartFirstRun =
    !isBusy &&
    !!brand.name.trim() &&
    !!brand.domain.trim() &&
    activeEngines.length > 0 &&
    selectedEngineIds.length > 0;

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t("review.title")}</CardTitle>
        <CardDescription>{t("review.description")}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <ReviewSection
          icon={Building2}
          title={t("review.brandSection")}
          onEdit={onEditStep}
          stepNumber={1}
        >
          <div className="rounded-lg bg-muted/50 p-4 space-y-2">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-8 gap-y-2 text-sm">
              <div>
                <span className="text-muted-foreground">
                  {t("brandBasics.nameLabel")}:
                </span>{" "}
                <span className="font-medium text-foreground">
                  {brand.name || "---"}
                </span>
              </div>
              <div>
                <span className="text-muted-foreground">
                  {t("brandBasics.domainLabel")}:
                </span>{" "}
                <span className="font-medium text-foreground">
                  {brand.domain || "---"}
                </span>
              </div>
              {brand.industry ? (
                <div>
                  <span className="text-muted-foreground">
                    {t("brandBasics.industryLabel")}:
                  </span>{" "}
                  <span className="font-medium text-foreground">
                    {brand.industry}
                  </span>
                </div>
              ) : null}
              {brand.tone_of_voice ? (
                <div>
                  <span className="text-muted-foreground">
                    {t("brandBasics.toneLabel")}:
                  </span>{" "}
                  <span className="font-medium text-foreground">
                    {brand.tone_of_voice}
                  </span>
                </div>
              ) : null}
              {brand.target_audience ? (
                <div className="sm:col-span-2">
                  <span className="text-muted-foreground">
                    {t("brandBasics.audienceLabel")}:
                  </span>{" "}
                  <span className="font-medium text-foreground">
                    {brand.target_audience}
                  </span>
                </div>
              ) : null}
            </div>
            {brand.description ? (
              <p className="text-sm text-muted-foreground pt-1">
                {brand.description}
              </p>
            ) : null}
            {(brand.unique_selling_points?.length ?? 0) > 0 ? (
              <div className="flex flex-wrap gap-1.5 pt-1">
                {brand.unique_selling_points!.map((usp, index) => (
                  <Badge key={index} variant="outline" className="text-xs">
                    {usp}
                  </Badge>
                ))}
              </div>
            ) : null}
          </div>
        </ReviewSection>

        <Separator />

        <ReviewSection
          icon={Package}
          title={t("review.productsSection")}
          count={filteredProducts.length}
          countKey="review.productsCount"
          onEdit={onEditStep}
          stepNumber={3}
        >
          {filteredProducts.length > 0 ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {filteredProducts.map((product, index) => (
                <div
                  key={index}
                  className="rounded-lg bg-muted/50 px-3 py-2 text-sm"
                >
                  <p className="font-medium text-foreground">{product.name}</p>
                  {product.category ? (
                    <p className="text-xs text-muted-foreground">
                      {product.category}
                    </p>
                  ) : null}
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">{t("review.noneAdded")}</p>
          )}
        </ReviewSection>

        <Separator />

        <ReviewSection
          icon={Swords}
          title={t("review.competitorsSection")}
          count={filteredCompetitors.length}
          countKey="review.competitorsCount"
          onEdit={onEditStep}
          stepNumber={4}
        >
          {filteredCompetitors.length > 0 ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {filteredCompetitors.map((competitor, index) => (
                <div
                  key={index}
                  className="rounded-lg bg-muted/50 px-3 py-2 text-sm"
                >
                  <p className="font-medium text-foreground">{competitor.name}</p>
                  {competitor.website ? (
                    <p className="text-xs text-muted-foreground">
                      {competitor.website}
                    </p>
                  ) : null}
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">{t("review.noneAdded")}</p>
          )}
        </ReviewSection>

        <Separator />

        <ReviewSection
          icon={FileText}
          title={t("review.filesSection")}
          count={files.length}
          countKey="review.filesCount"
          onEdit={onEditStep}
          stepNumber={5}
        >
          {files.length > 0 ? (
            <div className="flex flex-wrap gap-2">
              {files.map((file) => (
                <Badge key={file.id} variant="secondary" className="text-xs gap-1">
                  <FileText className="h-3 w-3" />
                  {file.filename}
                </Badge>
              ))}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">{t("review.noneAdded")}</p>
          )}
        </ReviewSection>

        <Separator />

        <div className="flex items-center gap-2">
          <BookOpen className="h-4 w-4 text-teal-600" />
          <h3 className="text-sm font-semibold text-foreground">
            {t("review.knowledgeSection")}
          </h3>
          <Badge variant="secondary" className="text-xs">
            {t("review.entriesCount", { count: knowledgeCount })}
          </Badge>
        </div>

        <Separator />

        {launchError ? (
          <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
            <div className="flex items-start gap-2">
              <CircleAlert className="mt-0.5 h-4 w-4 shrink-0" />
              <p>{launchError}</p>
            </div>
          </div>
        ) : null}

        <div className="rounded-xl border border-border bg-muted/20 p-4 space-y-5">
          <div className="flex items-start gap-3">
            <div className="mt-0.5 flex h-9 w-9 items-center justify-center rounded-full bg-background text-teal-600 shadow-xs">
              <Rocket className="h-4 w-4" />
            </div>
            <div className="space-y-1">
              <p className="text-sm font-semibold text-foreground">
                {t("review.starterRunTitle")}
              </p>
              <p className="text-sm text-muted-foreground">
                {t("review.starterRunDescription")}
              </p>
            </div>
          </div>

          <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)]">
            <div className="rounded-lg bg-background p-4 space-y-3">
              <div className="flex items-center gap-2">
                <ListChecks className="h-4 w-4 text-teal-600" />
                <p className="text-sm font-semibold text-foreground">
                  {t("review.starterRunIncludes")}
                </p>
              </div>
              <div className="space-y-2 text-sm text-muted-foreground">
                <p>{t("review.starterQuerySetSummary")}</p>
                <p>{t("review.starterQueryGenerationSummary")}</p>
                <p>{t("review.starterAutoApproveSummary")}</p>
              </div>
            </div>

            <div className="rounded-lg bg-background p-4 space-y-4">
              <div className="space-y-3">
                <div className="space-y-1">
                  <Label>{t("review.enginesLabel")}</Label>
                  <p className="text-xs text-muted-foreground">
                    {t("review.enginesHint")}
                  </p>
                </div>

                {activeEngines.length > 0 ? (
                  <div className="space-y-2">
                    {activeEngines.map((engine) => {
                      const checked = selectedEngineIds.includes(engine.id);
                      return (
                        <label
                          key={engine.id}
                          className="flex items-center justify-between rounded-lg border border-border px-3 py-2 text-sm"
                        >
                          <div>
                            <p className="font-medium text-foreground">{engine.name}</p>
                            <p className="text-xs text-muted-foreground">
                              {engine.provider}
                            </p>
                          </div>
                          <Checkbox
                            checked={checked}
                            onCheckedChange={() => onToggleEngine(engine.id)}
                            aria-label={engine.name}
                          />
                        </label>
                      );
                    })}
                  </div>
                ) : (
                  <p className="rounded-lg border border-dashed border-amber-200 bg-amber-50 px-3 py-3 text-sm text-amber-700">
                    {t("review.noActiveEngines")}
                  </p>
                )}

                {activeEngines.length > 0 && selectedEngineIds.length === 0 ? (
                  <p className="text-xs text-amber-700">
                    {t("review.selectAtLeastOneEngine")}
                  </p>
                ) : null}
              </div>

              <div className="space-y-2">
                <Label htmlFor="starter-sample-count">
                  {t("review.sampleCountLabel")}
                </Label>
                <Input
                  id="starter-sample-count"
                  type="number"
                  min={1}
                  max={10}
                  value={sampleCount}
                  onChange={(event) =>
                    onSampleCountChange(Number(event.target.value))
                  }
                />
                <p className="text-xs text-muted-foreground">
                  {t("review.sampleCountHint")}
                </p>
              </div>
            </div>
          </div>
        </div>

        <Separator />

        <div className="flex flex-col-reverse gap-3 pt-2 sm:flex-row sm:justify-end">
          <Button
            type="button"
            variant="outline"
            onClick={onFinishLater}
            disabled={isBusy || !brand.name.trim() || !brand.domain.trim()}
          >
            {launchAction === "finish" ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                {t("review.finishingSetup")}
              </>
            ) : (
              t("review.finishSetupLater")
            )}
          </Button>
          <Button
            type="button"
            onClick={onStartFirstRun}
            disabled={!canStartFirstRun}
            size="lg"
            className="gap-2"
          >
            {launchAction === "start" ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                {t("review.startingFirstRun")}
              </>
            ) : (
              <>
                <Rocket className="h-4 w-4" />
                {t("review.startFirstRun")}
              </>
            )}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
