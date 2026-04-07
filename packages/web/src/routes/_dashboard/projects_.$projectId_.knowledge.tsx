import { useState, useCallback, useEffect, useRef } from "react";
import { createFileRoute, Link, useNavigate, useSearch, useParams } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { ArrowLeft, ArrowRight, SkipForward } from "lucide-react";
import { useLocale } from "@/hooks/use-locale";
import { WizardStepper, TOTAL_STEPS } from "@/components/onboarding/wizard-stepper";
import { StepBrandBasics } from "@/components/onboarding/step-brand-basics";
import { StepCrawlWebsite } from "@/components/onboarding/step-crawl-website";
import { StepProducts } from "@/components/onboarding/step-products";
import { StepCompetitors } from "@/components/onboarding/step-competitors";
import { StepUploadFiles } from "@/components/onboarding/step-upload-files";
import { StepReview } from "@/components/onboarding/step-review";
import {
  useBrand,
  useUpdateBrand,
  useProducts,
  useCompetitors,
  useCreateProduct,
  useDeleteProduct,
  useCreateCompetitor,
  useDeleteCompetitor,
  useCrawlWebsite,
  useSuggestProducts,
  useSuggestCompetitors,
  useUploadFile,
  useKnowledgeEntries,
  useProjectFiles,
} from "@/hooks/use-brand";
import { useCreateQuerySet, type BatchUpdateQueriesResponse, type GenerateQueriesResponse } from "@/hooks/use-queries";
import { useCreateRun } from "@/hooks/use-runs";
import { useEngines } from "@/hooks/use-engines";
import { ApiError, apiGet, apiPost } from "@/lib/api-client";
import {
  toBrandPayload,
  fromBrandResponse,
  normalizeName,
  hasProduct,
  hasCompetitor,
  toProductDraft,
  toCompetitorDraft,
  productToCreate,
  competitorToCreate,
} from "@/lib/brand-mapping";
import {
  DEFAULT_STARTER_SAMPLE_COUNT,
  startFirstRun,
} from "@/lib/onboarding-launch";
import type {
  BrandProfileDraft,
  ProductCreate,
  ProductSuggestion,
  CompetitorCreate,
  CompetitorSuggestion,
  CustomFile,
  CrawlJob,
  KnowledgeEntry,
} from "@/types/brand";
import type { PaginatedResponse } from "@/types/api";
import type { Query, QuerySet } from "@/types/query";

type SearchParams = { step?: number };

export const Route = createFileRoute("/_dashboard/projects_/$projectId_/knowledge")({
  component: EditKnowledgePage,
  validateSearch: (search: Record<string, unknown>): SearchParams => ({
    step: Number(search.step) || 1,
  }),
});

function EditKnowledgePage() {
  const { t } = useTranslation("onboarding");
  const { locale: uiLocale } = useLocale();
  const [contentLocale, setContentLocale] = useState<"en" | "ru">(uiLocale as "en" | "ru");
  const navigate = useNavigate();
  const { projectId } = useParams({ from: "/_dashboard/projects_/$projectId_/knowledge" });
  const { step: currentStep } = useSearch({ from: "/_dashboard/projects_/$projectId_/knowledge" });
  const safeStep = Math.max(1, Math.min(currentStep ?? 1, TOTAL_STEPS));

  // -- API data --
  const { data: brand } = useBrand(projectId);
  const { data: existingProducts = [] } = useProducts(projectId);
  const { data: existingCompetitors = [] } = useCompetitors(projectId);
  const { data: knowledgeData } = useKnowledgeEntries(projectId);
  const { data: filesData } = useProjectFiles(projectId);
  const { data: engines = [] } = useEngines();
  const activeEngines = engines.filter((engine) => engine.is_active);

  // -- Wizard state --
  const [brandDraft, setBrandDraft] = useState<BrandProfileDraft>({
    name: "",
    domain: "",
    description: "",
    industry: "",
    tone_of_voice: "",
    target_audience: "",
    unique_selling_points: [],
  });
  const [brandErrors, setBrandErrors] = useState<Record<string, string>>({});
  const [products, setProducts] = useState<ProductCreate[]>([]);
  const [competitors, setCompetitors] = useState<CompetitorCreate[]>([]);
  const [productSuggestions, setProductSuggestions] = useState<ProductSuggestion[]>([]);
  const [competitorSuggestions, setCompetitorSuggestions] = useState<CompetitorSuggestion[]>([]);
  const [productSuggestionError, setProductSuggestionError] = useState<string | null>(null);
  const [competitorSuggestionError, setCompetitorSuggestionError] = useState<string | null>(null);
  const [files, setFiles] = useState<CustomFile[]>([]);
  const [crawlJob, setCrawlJob] = useState<CrawlJob | null>(null);
  const [launchAction, setLaunchAction] = useState<"start" | "finish" | null>(null);
  const [launchError, setLaunchError] = useState<string | null>(null);
  const [selectedEngineIds, setSelectedEngineIds] = useState<string[]>([]);
  const [sampleCount, setSampleCount] = useState(DEFAULT_STARTER_SAMPLE_COUNT);
  const [enginesInitialized, setEnginesInitialized] = useState(false);
  const initializedRef = useRef(false);

  // -- Mutations --
  const updateBrand = useUpdateBrand(projectId);
  const createProduct = useCreateProduct(projectId);
  const deleteProduct = useDeleteProduct(projectId);
  const createCompetitor = useCreateCompetitor(projectId);
  const deleteCompetitor = useDeleteCompetitor(projectId);
  const createQuerySet = useCreateQuerySet(projectId);
  const createRun = useCreateRun(projectId);
  const crawlWebsite = useCrawlWebsite(projectId);
  const suggestProducts = useSuggestProducts(projectId);
  const suggestCompetitors = useSuggestCompetitors(projectId);
  const uploadFile = useUploadFile(projectId);

  // -- Initialize wizard state from API data --
  useEffect(() => {
    if (initializedRef.current) return;
    if (!brand) return;

    initializedRef.current = true;
    setBrandDraft(fromBrandResponse(brand));
    setProducts(existingProducts.map(productToCreate));
    setCompetitors(existingCompetitors.map(competitorToCreate));
  }, [brand, existingProducts, existingCompetitors]);

  useEffect(() => {
    if (!enginesInitialized && activeEngines.length > 0) {
      setSelectedEngineIds(activeEngines.map((engine) => engine.id));
      setEnginesInitialized(true);
    }
  }, [activeEngines, enginesInitialized]);

  // -- Autofill --
  const handleAutofill = useCallback(
    async (domain: string): Promise<Partial<BrandProfileDraft>> => {
      const result = await apiPost<{
        name: string;
        description: string;
        industry: string;
        tone_of_voice: string;
        target_audience: string;
        unique_selling_points: string[];
      }>("/brand/autofill", {
        domain,
        locale: contentLocale,
      });
      return {
        name: result.name,
        description: result.description,
        industry: result.industry,
        tone_of_voice: result.tone_of_voice,
        target_audience: result.target_audience,
        unique_selling_points: result.unique_selling_points,
      };
    },
    [contentLocale],
  );

  // -- Navigation --
  function goToStep(step: number) {
    navigate({
      to: "/projects/$projectId/knowledge",
      search: { step },
      params: { projectId },
      replace: true,
    });
  }

  function validateBrandBasics(): boolean {
    const errors: Record<string, string> = {};
    if (!brandDraft.name.trim()) {
      errors.name = t("brandBasics.nameRequired");
    }
    if (!brandDraft.domain.trim()) {
      errors.domain = t("brandBasics.domainRequired");
    }
    setBrandErrors(errors);
    return Object.keys(errors).length === 0;
  }

  async function handleNext() {
    if (safeStep === 1) {
      if (!validateBrandBasics()) return;
      try {
        await updateBrand.mutateAsync(toBrandPayload(brandDraft));
      } catch {
        /* continue anyway */
      }
    }
    if (safeStep < TOTAL_STEPS) {
      goToStep(safeStep + 1);
    }
  }

  function handleBack() {
    if (safeStep > 1) {
      goToStep(safeStep - 1);
    }
  }

  function handleSkip() {
    if (safeStep < TOTAL_STEPS) {
      goToStep(safeStep + 1);
    }
  }

  function handleStepClick(step: number) {
    // Allow navigating to any step in edit mode
    goToStep(step);
  }

  function toggleEngine(engineId: string) {
    setSelectedEngineIds((prev) =>
      prev.includes(engineId)
        ? prev.filter((id) => id !== engineId)
        : [...prev, engineId],
    );
  }

  function updateSampleCount(value: number) {
    if (!Number.isFinite(value)) {
      setSampleCount(DEFAULT_STARTER_SAMPLE_COUNT);
      return;
    }
    setSampleCount(Math.max(1, Math.min(10, Math.round(value))));
  }

  // -- Crawl handler --
  const handleStartCrawl = useCallback(
    async (domain: string, maxPages: number) => {
      setCrawlJob({
        domain,
        status: "crawling",
        pages_found: 0,
        pages_crawled: 0,
        entries_created: 0,
        pages: [],
        knowledge_entries: [],
        error_message: null,
        started_at: new Date().toISOString(),
        completed_at: null,
      });

      try {
        const result = await crawlWebsite.mutateAsync({
          domain: domain.startsWith("http") ? domain : `https://${domain}`,
          max_pages: maxPages,
        });
        setCrawlJob((prev) =>
          prev
            ? {
                ...prev,
                status: "completed",
                pages_found: result.total_pages ?? result.pages_crawled ?? 0,
                pages_crawled: result.pages_crawled ?? 0,
                entries_created: result.entries_created ?? 0,
                pages: result.pages ?? [],
                knowledge_entries: result.knowledge_entries ?? [],
                completed_at: new Date().toISOString(),
              }
            : null,
        );
      } catch (e) {
        setCrawlJob((prev) =>
          prev
            ? {
                ...prev,
                status: "error",
                error_message: e instanceof Error ? e.message : "Crawl failed",
              }
            : null,
        );
      }
    },
    [crawlWebsite],
  );

  // -- File upload --
  const handleFileUpload = useCallback(
    async (newFiles: File[]) => {
      for (const file of newFiles) {
        try {
          const uploadedFile = await uploadFile.mutateAsync(file);
          setFiles((prev) => [...prev, uploadedFile]);
        } catch {
          // silently continue
        }
      }
    },
    [uploadFile],
  );

  const handleFileRemove = useCallback((fileId: string) => {
    setFiles((prev) => prev.filter((f) => f.id !== fileId));
  }, []);

  // -- Suggest products --
  function getCompetitorSuggestionError(error: unknown): string {
    if (error instanceof ApiError && error.code === "search.not_configured") {
      return t("competitors.suggestUnavailable");
    }
    return t("competitors.suggestFailed");
  }

  const handleSuggestProducts = useCallback(async () => {
    const crawlHasPages = Boolean(
      (crawlJob?.pages.length ?? 0) > 0 || (crawlJob?.pages_crawled ?? 0) > 0,
    );
    setProductSuggestionError(null);
    try {
      const result = await suggestProducts.mutateAsync({ max_suggestions: 5 });
      const nextSuggestions = (result.suggestions ?? []).filter(
        (suggestion) => !hasProduct(products, suggestion),
      );
      setProductSuggestions(nextSuggestions);
      if (nextSuggestions.length === 0) {
        setProductSuggestionError(t("products.noSuggestionsFound"));
      }
    } catch (error) {
      if (error instanceof ApiError && error.code === "discovery.no_knowledge") {
        setProductSuggestionError(
          crawlHasPages
            ? t("products.suggestNoExtractedKnowledge")
            : t("products.suggestNoKnowledge"),
        );
      } else {
        setProductSuggestionError(t("products.suggestFailed"));
      }
    }
  }, [crawlJob, products, suggestProducts, t]);

  const handleSuggestCompetitors = useCallback(async () => {
    setCompetitorSuggestionError(null);
    try {
      const result = await suggestCompetitors.mutateAsync({ max_suggestions: 5 });
      const nextSuggestions = (result.suggestions ?? []).filter(
        (suggestion) => !hasCompetitor(competitors, suggestion),
      );
      setCompetitorSuggestions(nextSuggestions);
      if (nextSuggestions.length === 0) {
        setCompetitorSuggestionError(t("competitors.noSuggestionsFound"));
      }
    } catch (error) {
      setCompetitorSuggestionError(getCompetitorSuggestionError(error));
    }
  }, [competitors, suggestCompetitors, t]);

  const acceptProductSuggestion = useCallback((suggestion: ProductSuggestion) => {
    setProducts((prev) => {
      if (hasProduct(prev, suggestion)) return prev;
      return [...prev, toProductDraft(suggestion)];
    });
    setProductSuggestions((prev) =>
      prev.filter((item) => normalizeName(item.name) !== normalizeName(suggestion.name)),
    );
  }, []);

  const acceptAllProductSuggestions = useCallback(() => {
    setProducts((prev) => {
      const next = [...prev];
      for (const suggestion of productSuggestions) {
        if (!hasProduct(next, suggestion)) {
          next.push(toProductDraft(suggestion));
        }
      }
      return next;
    });
    setProductSuggestions([]);
  }, [productSuggestions]);

  const dismissProductSuggestion = useCallback((suggestion: ProductSuggestion) => {
    setProductSuggestions((prev) =>
      prev.filter((item) => normalizeName(item.name) !== normalizeName(suggestion.name)),
    );
  }, []);

  const acceptCompetitorSuggestion = useCallback(
    (suggestion: CompetitorSuggestion) => {
      setCompetitors((prev) => {
        if (hasCompetitor(prev, suggestion)) return prev;
        return [...prev, toCompetitorDraft(suggestion)];
      });
      setCompetitorSuggestions((prev) =>
        prev.filter((item) => normalizeName(item.name) !== normalizeName(suggestion.name)),
      );
    },
    [],
  );

  const acceptAllCompetitorSuggestions = useCallback(() => {
    setCompetitors((prev) => {
      const next = [...prev];
      for (const suggestion of competitorSuggestions) {
        if (!hasCompetitor(next, suggestion)) {
          next.push(toCompetitorDraft(suggestion));
        }
      }
      return next;
    });
    setCompetitorSuggestions([]);
  }, [competitorSuggestions]);

  const dismissCompetitorSuggestion = useCallback(
    (suggestion: CompetitorSuggestion) => {
      setCompetitorSuggestions((prev) =>
        prev.filter((item) => normalizeName(item.name) !== normalizeName(suggestion.name)),
      );
    },
    [],
  );

  // -- Merged data for display --
  const allFiles = [
    ...files,
    ...(filesData ?? []).filter(
      (f: CustomFile) => !files.some((lf) => lf.id === f.id),
    ),
  ];
  const persistedKnowledge = (knowledgeData?.items ?? []) as KnowledgeEntry[];
  const hasPersistedKnowledge = persistedKnowledge.length > 0;
  const hasFreshKnowledge = Boolean(
    (crawlJob?.knowledge_entries.length ?? 0) > 0 || (crawlJob?.entries_created ?? 0) > 0,
  );
  const hasCrawledPages = Boolean(
    (crawlJob?.pages.length ?? 0) > 0 || (crawlJob?.pages_crawled ?? 0) > 0,
  );
  const hasAvailableKnowledge = hasPersistedKnowledge || hasFreshKnowledge;
  const knowledgeCount = Math.max(
    persistedKnowledge.length,
    crawlJob?.entries_created ?? 0,
  );
  const productSuggestPrerequisiteMessage = hasAvailableKnowledge
    ? null
    : hasCrawledPages
      ? t("products.suggestNoExtractedKnowledge")
      : t("products.suggestNoKnowledge");

  // -- Save helpers for review step --
  async function saveNewProducts() {
    const existingNames = new Set(
      existingProducts.map((p) => normalizeName(p.name)),
    );
    for (const product of products) {
      if (!product.name.trim()) continue;
      if (existingNames.has(normalizeName(product.name))) continue;
      try {
        await createProduct.mutateAsync(product);
      } catch {
        /* resilient */
      }
    }
    // Delete removed products
    const currentNames = new Set(products.map((p) => normalizeName(p.name)));
    for (const existing of existingProducts) {
      if (!currentNames.has(normalizeName(existing.name))) {
        try {
          await deleteProduct.mutateAsync(existing.id);
        } catch {
          /* resilient */
        }
      }
    }
  }

  async function saveNewCompetitors() {
    const existingNames = new Set(
      existingCompetitors.map((c) => normalizeName(c.name)),
    );
    for (const competitor of competitors) {
      if (!competitor.name.trim()) continue;
      if (existingNames.has(normalizeName(competitor.name))) continue;
      try {
        await createCompetitor.mutateAsync(competitor);
      } catch {
        /* resilient */
      }
    }
    // Delete removed competitors
    const currentNames = new Set(competitors.map((c) => normalizeName(c.name)));
    for (const existing of existingCompetitors) {
      if (!currentNames.has(normalizeName(existing.name))) {
        try {
          await deleteCompetitor.mutateAsync(existing.id);
        } catch {
          /* resilient */
        }
      }
    }
  }

  async function handleFinishLater() {
    setLaunchAction("finish");
    setLaunchError(null);

    try {
      await saveNewProducts();
      await saveNewCompetitors();
      setLaunchAction(null);
      navigate({ to: "/projects/$projectId", params: { projectId } });
      return;
    } catch {
      setLaunchError(t("review.finishLaterFailed"));
    }
    setLaunchAction(null);
  }

  async function listQuerySetsForProject(): Promise<QuerySet[]> {
    const response = await apiGet<PaginatedResponse<QuerySet>>(
      `/projects/${projectId}/query-sets?limit=100`,
    );
    return response.items;
  }

  async function listQueriesForSet(querySetId: string): Promise<Query[]> {
    const response = await apiGet<PaginatedResponse<Query>>(
      `/projects/${projectId}/query-sets/${querySetId}/queries?limit=100`,
    );
    return response.items;
  }

  async function handleStartFirstRun() {
    if (activeEngines.length === 0) {
      setLaunchError(t("review.noActiveEngines"));
      return;
    }
    if (selectedEngineIds.length === 0) {
      setLaunchError(t("review.selectAtLeastOneEngine"));
      return;
    }

    setLaunchAction("start");
    setLaunchError(null);

    try {
      // Save new products/competitors first
      await saveNewProducts();
      await saveNewCompetitors();

      const result = await startFirstRun(
        {
          products: [],
          competitors: [],
          existingQuerySets: await listQuerySetsForProject(),
          selectedEngineIds,
          sampleCount,
        },
        {
          saveProduct: async () => {},
          saveCompetitor: async () => {},
          createQuerySet: (data) => createQuerySet.mutateAsync(data),
          listQueries: listQueriesForSet,
          generateQueries: (querySetId, data) =>
            apiPost<GenerateQueriesResponse>(
              `/projects/${projectId}/query-sets/${querySetId}/generate`,
              data,
            ),
          approveQueries: (querySetId, queryIds) =>
            apiPost<BatchUpdateQueriesResponse>(
              `/projects/${projectId}/query-sets/${querySetId}/queries/batch-update`,
              {
                query_ids: queryIds,
                status: "approved",
              },
            ),
          createRun: (data) => createRun.mutateAsync(data),
        },
      );

      if (result.runs.length === 0) {
        setLaunchError(t("review.firstRunFailed"));
        return;
      }

      if (result.failures.length > 0) {
        toast(
          t("review.firstRunPartial", {
            created: result.runs.length,
            failed: result.failures.length,
          }),
        );
      }

      setLaunchAction(null);
      navigate({ to: "/projects/$projectId/runs", params: { projectId } });
      return;
    } catch {
      setLaunchError(t("review.firstRunFailed"));
    }
    setLaunchAction(null);
  }

  // Steps 2-5 are skippable
  const isSkippable = safeStep >= 2 && safeStep <= 5;

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon-xs" asChild>
            <Link to="/projects/$projectId" params={{ projectId }}>
              <ArrowLeft className="w-4 h-4" />
            </Link>
          </Button>
          <div>
            <h2 className="text-2xl font-bold text-foreground">{t("editWizard.title")}</h2>
            <p className="text-sm text-muted-foreground mt-1">{t("editWizard.subtitle")}</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <Button variant="outline" size="sm" asChild>
            <Link to="/projects/$projectId" params={{ projectId }}>
              {t("editWizard.backToProject")}
            </Link>
          </Button>
          <div className="flex items-center gap-1 rounded-lg border bg-muted/50 p-1">
            <Button
              variant={contentLocale === "en" ? "default" : "ghost"}
              size="sm"
              className="h-7 px-3 text-xs font-medium"
              onClick={() => setContentLocale("en")}
            >
              EN
            </Button>
            <Button
              variant={contentLocale === "ru" ? "default" : "ghost"}
              size="sm"
              className="h-7 px-3 text-xs font-medium"
              onClick={() => setContentLocale("ru")}
            >
              RU
            </Button>
          </div>
        </div>
      </div>

      {/* Stepper */}
      <WizardStepper currentStep={safeStep} onStepClick={handleStepClick} />

      {/* Step content */}
      <div className="min-h-[400px]">
        {safeStep === 1 && (
          <StepBrandBasics
            data={brandDraft}
            onChange={setBrandDraft}
            errors={brandErrors}
            onAutofill={handleAutofill}
          />
        )}
        {safeStep === 2 && (
          <StepCrawlWebsite
            domain={brandDraft.domain}
            crawlJob={crawlJob}
            isCrawling={false}
            persistedKnowledge={persistedKnowledge}
            onStartCrawl={handleStartCrawl}
          />
        )}
        {safeStep === 3 && (
          <StepProducts
            products={products}
            onChange={setProducts}
            suggestions={productSuggestions}
            isSuggesting={suggestProducts.isPending}
            suggestionError={productSuggestionError}
            canSuggest={hasAvailableKnowledge}
            suggestPrerequisiteMessage={productSuggestPrerequisiteMessage}
            onSuggest={handleSuggestProducts}
            onAcceptSuggestion={acceptProductSuggestion}
            onAcceptAllSuggestions={acceptAllProductSuggestions}
            onDismissSuggestion={dismissProductSuggestion}
          />
        )}
        {safeStep === 4 && (
          <StepCompetitors
            competitors={competitors}
            onChange={setCompetitors}
            suggestions={competitorSuggestions}
            isSuggesting={suggestCompetitors.isPending}
            suggestionError={competitorSuggestionError}
            canSuggest={true}
            onSuggest={handleSuggestCompetitors}
            onAcceptSuggestion={acceptCompetitorSuggestion}
            onAcceptAllSuggestions={acceptAllCompetitorSuggestions}
            onDismissSuggestion={dismissCompetitorSuggestion}
          />
        )}
        {safeStep === 5 && (
          <StepUploadFiles
            files={allFiles}
            isUploading={false}
            onUpload={handleFileUpload}
            onRemove={handleFileRemove}
          />
        )}
        {safeStep === 6 && (
          <StepReview
            brand={brandDraft}
            products={products}
            competitors={competitors}
            files={allFiles}
            knowledgeCount={knowledgeCount}
            activeEngines={activeEngines}
            selectedEngineIds={selectedEngineIds}
            sampleCount={sampleCount}
            launchAction={launchAction}
            launchError={launchError}
            onToggleEngine={toggleEngine}
            onSampleCountChange={updateSampleCount}
            onStartFirstRun={handleStartFirstRun}
            onFinishLater={handleFinishLater}
            onEditStep={goToStep}
          />
        )}
      </div>

      {/* Navigation buttons */}
      {safeStep < TOTAL_STEPS && safeStep < 6 && (
        <div className="flex items-center justify-between pt-4 border-t border-border">
          <div>
            {safeStep > 1 && (
              <Button type="button" variant="outline" onClick={handleBack}>
                <ArrowLeft className="h-4 w-4" />
                {t("navigation.back")}
              </Button>
            )}
          </div>
          <div className="flex items-center gap-2">
            {isSkippable && (
              <Button type="button" variant="ghost" onClick={handleSkip}>
                <SkipForward className="h-4 w-4" />
                {t("navigation.skip")}
              </Button>
            )}
            <Button type="button" onClick={handleNext}>
              {t("navigation.next")}
              <ArrowRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      )}

      {/* Back button on review page */}
      {safeStep === 6 && (
        <div className="flex items-center pt-4 border-t border-border">
          <Button type="button" variant="outline" onClick={handleBack}>
            <ArrowLeft className="h-4 w-4" />
            {t("navigation.back")}
          </Button>
        </div>
      )}
    </div>
  );
}
