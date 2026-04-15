import { useState, useCallback, useEffect, useRef } from "react";
import { createFileRoute, useNavigate, useSearch } from "@tanstack/react-router";
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
import { StepReviewQuestions } from "@/components/onboarding/step-review-questions";
import { useCreateProject } from "@/hooks/use-projects";
import {
  useUpdateBrand,
  useCreateProduct,
  useCreateCompetitor,
  useCrawlWebsite,
  useSuggestCompetitors,
  useSuggestProducts,
  useUploadFile,
  useKnowledgeEntries,
  useProjectFiles,
} from "@/hooks/use-brand";
import { useCreateQuerySet, type BatchUpdateQueriesResponse, type GenerateQueriesResponse } from "@/hooks/use-queries";
import { useCreateRun } from "@/hooks/use-runs";
import { useEngines } from "@/hooks/use-engines";
import { ApiError, apiGet, apiPost, apiPut } from "@/lib/api-client";
import {
  DEFAULT_STARTER_SAMPLE_COUNT,
  finishSetupLater,
  generateStarterQueries,
  launchRuns,
} from "@/lib/onboarding-launch";
import {
  toBrandPayload,
  normalizeName,
  hasProduct,
  hasCompetitor,
  toProductDraft,
  toCompetitorDraft,
} from "@/lib/brand-mapping";
import type {
  Brand,
  BrandAutofillResponse,
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
import {
  parseDashboardSearch,
  type DashboardSearchState,
} from "@/lib/dashboard-search";

type SearchParams = DashboardSearchState & { step?: number };

export const Route = createFileRoute("/_dashboard/projects_/new")({
  component: NewProjectWizard,
  validateSearch: (search: Record<string, unknown>): SearchParams => ({
    ...parseDashboardSearch(search),
    step: Number(search.step) || 1,
  }),
});

function NewProjectWizard() {
  const { t } = useTranslation("onboarding");
  const { locale: uiLocale } = useLocale();
  const [contentLocale, setContentLocale] = useState<"en" | "ru">(uiLocale as "en" | "ru");
  const navigate = useNavigate();
  const { step: currentStep } = useSearch({ from: "/_dashboard/projects_/new" });
  const safeStep = Math.max(1, Math.min(currentStep ?? 1, TOTAL_STEPS));

  // -- Wizard state --
  const [brand, setBrand] = useState<BrandProfileDraft>({
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
  const [generatedQueries, setGeneratedQueries] = useState<Query[]>([]);
  const [generatedQuerySet, setGeneratedQuerySet] = useState<QuerySet | null>(null);
  const [isGeneratingQueries, setIsGeneratingQueries] = useState(false);
  const [generateQueriesError, setGenerateQueriesError] = useState<string | null>(null);

  // Project ID is created at step 1 and persisted for subsequent steps
  const [projectId, setProjectId] = useState<string | null>(null);
  const projectCreatingRef = useRef(false);

  const createProject = useCreateProject();
  const updateBrand = useUpdateBrand(projectId ?? "");
  const createProduct = useCreateProduct(projectId ?? "");
  const createCompetitor = useCreateCompetitor(projectId ?? "");
  const createQuerySet = useCreateQuerySet(projectId ?? "");
  const createRun = useCreateRun(projectId ?? "");
  const crawlWebsite = useCrawlWebsite(projectId ?? "");
  const suggestProducts = useSuggestProducts(projectId ?? "");
  const suggestCompetitors = useSuggestCompetitors(projectId ?? "");
  const uploadFile = useUploadFile(projectId ?? "");
  const { data: engines = [] } = useEngines();

  // Real data from API for review step
  const { data: knowledgeData } = useKnowledgeEntries(projectId ?? "");
  const { data: filesData } = useProjectFiles(projectId ?? "");
  const activeEngines = engines.filter((engine) => engine.is_active);

  useEffect(() => {
    if (!enginesInitialized && activeEngines.length > 0) {
      setSelectedEngineIds(activeEngines.map((engine) => engine.id));
      setEnginesInitialized(true);
    }
  }, [activeEngines, enginesInitialized]);

  function getCompetitorSuggestionError(error: unknown): string {
    if (error instanceof ApiError && error.code === "search.not_configured") {
      return t("competitors.suggestUnavailable");
    }
    return t("competitors.suggestFailed");
  }

  // -- Autofill brand from domain --
  const handleAutofill = useCallback(
    async (domain: string): Promise<Partial<BrandProfileDraft>> => {
      const result = await apiPost<BrandAutofillResponse>("/brand/autofill", {
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
    [contentLocale]
  );

  // -- Navigation --
  function goToStep(step: number) {
    navigate({
      to: "/projects/new",
      search: { step },
      replace: true,
    });
  }

  function validateBrandBasics(): boolean {
    const errors: Record<string, string> = {};
    if (!brand.name.trim()) {
      errors.name = t("brandBasics.nameRequired");
    }
    if (!brand.domain.trim()) {
      errors.domain = t("brandBasics.domainRequired");
    }
    setBrandErrors(errors);
    return Object.keys(errors).length === 0;
  }

  // Create project + brand when advancing from step 1
  async function handleNext() {
    if (safeStep === 1) {
      if (!validateBrandBasics()) return;
      // Create project if not yet created
      if (!projectId && !projectCreatingRef.current) {
        projectCreatingRef.current = true;
        try {
          const project = await createProject.mutateAsync({
            name: brand.name,
            domain: brand.domain,
            description: brand.description ?? "",
            client_name: brand.name,
            content_locale: contentLocale,
          });
          setProjectId(project.id);
          await apiPut<Brand>(
            `/projects/${project.id}/brand`,
            toBrandPayload(brand)
          );
        } catch (e) {
          projectCreatingRef.current = false;
          return;
        }
      } else if (projectId) {
        try {
          await updateBrand.mutateAsync(toBrandPayload(brand));
        } catch { /* continue anyway */ }
      }
    }
    // Trigger query generation when advancing to the questions step (step 6)
    if (safeStep === 5 && generatedQueries.length === 0 && !isGeneratingQueries) {
      goToStep(6);
      void handleGenerateQueries();
      return;
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
    if (step <= safeStep) {
      goToStep(step);
    }
  }

  function toggleEngine(engineId: string) {
    setSelectedEngineIds((prev) =>
      prev.includes(engineId)
        ? prev.filter((id) => id !== engineId)
        : [...prev, engineId]
    );
  }

  function updateSampleCount(value: number) {
    if (!Number.isFinite(value)) {
      setSampleCount(DEFAULT_STARTER_SAMPLE_COUNT);
      return;
    }
    setSampleCount(Math.max(1, Math.min(10, Math.round(value))));
  }

  // -- Real crawl handler --
  const handleStartCrawl = useCallback(
    async (domain: string, maxPages: number) => {
      if (!projectId) return;
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
            : null
        );
      } catch (e) {
        setCrawlJob((prev) =>
          prev
            ? {
                ...prev,
                status: "error",
                error_message: e instanceof Error ? e.message : "Crawl failed",
              }
            : null
        );
      }
    },
    [projectId, crawlWebsite]
  );

  // -- Real file upload handler --
  const handleFileUpload = useCallback(
    async (newFiles: File[]) => {
      if (!projectId) return;
      for (const file of newFiles) {
        try {
          const uploadedFile = await uploadFile.mutateAsync(file);
          setFiles((prev) => [...prev, uploadedFile]);
        } catch {
          // Show error per file if needed
        }
      }
      // Files will appear via useProjectFiles query
    },
    [projectId, uploadFile]
  );

  const handleFileRemove = useCallback((fileId: string) => {
    setFiles((prev) => prev.filter((f) => f.id !== fileId));
  }, []);

  const handleSuggestProducts = useCallback(async () => {
    if (!projectId) return;
    const crawlHasPages = Boolean(
      (crawlJob?.pages.length ?? 0) > 0 || (crawlJob?.pages_crawled ?? 0) > 0
    );
    setProductSuggestionError(null);
    try {
      const result = await suggestProducts.mutateAsync({ max_suggestions: 5 });
      const nextSuggestions = (result.suggestions ?? []).filter(
        (suggestion) => !hasProduct(products, suggestion)
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
            : t("products.suggestNoKnowledge")
        );
      } else {
        setProductSuggestionError(t("products.suggestFailed"));
      }
    }
  }, [crawlJob, projectId, products, suggestProducts, t]);

  const handleSuggestCompetitors = useCallback(async () => {
    if (!projectId) return;
    setCompetitorSuggestionError(null);
    try {
      const result = await suggestCompetitors.mutateAsync({ max_suggestions: 5 });
      const nextSuggestions = (result.suggestions ?? []).filter(
        (suggestion) => !hasCompetitor(competitors, suggestion)
      );
      setCompetitorSuggestions(nextSuggestions);
      if (nextSuggestions.length === 0) {
        setCompetitorSuggestionError(t("competitors.noSuggestionsFound"));
      }
    } catch (error) {
      setCompetitorSuggestionError(getCompetitorSuggestionError(error));
    }
  }, [projectId, competitors, suggestCompetitors, t]);

  const acceptProductSuggestion = useCallback((suggestion: ProductSuggestion) => {
    setProducts((prev) => {
      if (hasProduct(prev, suggestion)) {
        return prev;
      }
      return [...prev, toProductDraft(suggestion)];
    });
    setProductSuggestions((prev) =>
      prev.filter((item) => normalizeName(item.name) !== normalizeName(suggestion.name))
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
      prev.filter((item) => normalizeName(item.name) !== normalizeName(suggestion.name))
    );
  }, []);

  const acceptCompetitorSuggestion = useCallback(
    (suggestion: CompetitorSuggestion) => {
      setCompetitors((prev) => {
        if (hasCompetitor(prev, suggestion)) {
          return prev;
        }
        return [...prev, toCompetitorDraft(suggestion)];
      });
      setCompetitorSuggestions((prev) =>
        prev.filter((item) => normalizeName(item.name) !== normalizeName(suggestion.name))
      );
    },
    []
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
        prev.filter((item) => normalizeName(item.name) !== normalizeName(suggestion.name))
      );
    },
    []
  );

  // Merge API files with local state for display
  const allFiles = [
    ...files,
    ...(filesData ?? []).filter(
      (f: CustomFile) => !files.some((lf) => lf.id === f.id)
    ),
  ];
  const persistedKnowledge = (knowledgeData?.items ?? []) as KnowledgeEntry[];
  const hasPersistedKnowledge = persistedKnowledge.length > 0;
  const hasFreshKnowledge = Boolean(
    (crawlJob?.knowledge_entries.length ?? 0) > 0 || (crawlJob?.entries_created ?? 0) > 0
  );
  const hasCrawledPages = Boolean(
    (crawlJob?.pages.length ?? 0) > 0 || (crawlJob?.pages_crawled ?? 0) > 0
  );
  const hasAvailableKnowledge = hasPersistedKnowledge || hasFreshKnowledge;
  const knowledgeCount = Math.max(
    persistedKnowledge.length,
    crawlJob?.entries_created ?? 0
  );
  const productSuggestPrerequisiteMessage = hasAvailableKnowledge
    ? null
    : hasCrawledPages
      ? t("products.suggestNoExtractedKnowledge")
      : t("products.suggestNoKnowledge");

  async function saveProductDraft(product: ProductCreate) {
    try {
      await createProduct.mutateAsync(product);
    } catch {
      // Keep launch resilient if optional catalog items fail to save.
    }
  }

  async function saveCompetitorDraft(competitor: CompetitorCreate) {
    try {
      await createCompetitor.mutateAsync(competitor);
    } catch {
      // Keep launch resilient if optional catalog items fail to save.
    }
  }

  async function listQuerySetsForProject(): Promise<QuerySet[]> {
    if (!projectId) {
      return [];
    }

    const response = await apiGet<PaginatedResponse<QuerySet>>(
      `/projects/${projectId}/query-sets?limit=100`
    );
    return response.items;
  }

  async function listQueriesForSet(querySetId: string): Promise<Query[]> {
    if (!projectId) {
      return [];
    }

    const response = await apiGet<PaginatedResponse<Query>>(
      `/projects/${projectId}/query-sets/${querySetId}/queries?limit=100`
    );
    return response.items;
  }

  async function handleGenerateQueries() {
    if (!projectId) return;
    setIsGeneratingQueries(true);
    setGenerateQueriesError(null);

    try {
      const result = await generateStarterQueries(
        {
          products,
          competitors,
          existingQuerySets: await listQuerySetsForProject(),
        },
        {
          saveProduct: saveProductDraft,
          saveCompetitor: saveCompetitorDraft,
          createQuerySet: (data) => createQuerySet.mutateAsync(data),
          listQueries: listQueriesForSet,
          generateQueries: (querySetId, data) =>
            apiPost<GenerateQueriesResponse>(
              `/projects/${projectId}/query-sets/${querySetId}/generate`,
              data
            ),
        }
      );

      setGeneratedQuerySet(result.querySet);
      setGeneratedQueries(result.queries);
    } catch {
      setGenerateQueriesError(t("reviewQuestions.generateFailed"));
    }

    setIsGeneratingQueries(false);
  }

  async function handleRegenerateQueries() {
    if (!projectId || !generatedQuerySet) return;
    setIsGeneratingQueries(true);
    setGenerateQueriesError(null);

    try {
      const generated = await apiPost<GenerateQueriesResponse>(
        `/projects/${projectId}/query-sets/${generatedQuerySet.id}/generate`,
        { count: 10 }
      );
      setGeneratedQueries(generated.queries);
    } catch {
      setGenerateQueriesError(t("reviewQuestions.generateFailed"));
    }

    setIsGeneratingQueries(false);
  }

  async function handleFinishLater() {
    if (!projectId) return;

    setLaunchAction("finish");
    setLaunchError(null);

    try {
      await finishSetupLater(products, competitors, {
        saveProduct: saveProductDraft,
        saveCompetitor: saveCompetitorDraft,
      });
      setLaunchAction(null);
      navigate({ to: "/projects/$projectId", params: { projectId } });
      return;
    } catch {
      setLaunchError(t("review.finishLaterFailed"));
    }

    setLaunchAction(null);
  }

  async function handleStartFirstRun() {
    if (!projectId) return;

    if (activeEngines.length === 0) {
      setLaunchError(t("review.noActiveEngines"));
      return;
    }

    if (selectedEngineIds.length === 0) {
      setLaunchError(t("review.selectAtLeastOneEngine"));
      return;
    }

    // If queries weren't generated in step 6 (user skipped), fall back to generating now
    let querySet = generatedQuerySet;
    let queries = generatedQueries;

    if (!querySet || queries.length === 0) {
      try {
        const result = await generateStarterQueries(
          {
            products,
            competitors,
            existingQuerySets: await listQuerySetsForProject(),
          },
          {
            saveProduct: saveProductDraft,
            saveCompetitor: saveCompetitorDraft,
            createQuerySet: (data) => createQuerySet.mutateAsync(data),
            listQueries: listQueriesForSet,
            generateQueries: (querySetId, data) =>
              apiPost<GenerateQueriesResponse>(
                `/projects/${projectId}/query-sets/${querySetId}/generate`,
                data
              ),
          }
        );
        querySet = result.querySet;
        queries = result.queries;
      } catch {
        setLaunchError(t("review.firstRunFailed"));
        return;
      }
    }

    setLaunchAction("start");
    setLaunchError(null);

    try {
      const result = await launchRuns(
        {
          querySet,
          queries,
          selectedEngineIds,
          sampleCount,
        },
        {
          approveQueries: (querySetId, queryIds) =>
            apiPost<BatchUpdateQueriesResponse>(
              `/projects/${projectId}/query-sets/${querySetId}/queries/batch-update`,
              {
                query_ids: queryIds,
                status: "approved",
              }
            ),
          createRun: (data) => createRun.mutateAsync(data),
        }
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
          })
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

  // Whether the current step is skippable (steps 2-6 are optional)
  const isSkippable = safeStep >= 2 && safeStep <= 6;

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h2 className="text-2xl font-bold text-foreground">{t("title")}</h2>
          <p className="text-sm text-muted-foreground mt-1">{t("subtitle")}</p>
        </div>
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

      {/* Stepper */}
      <WizardStepper currentStep={safeStep} onStepClick={handleStepClick} />

      {/* Step content */}
      <div className="min-h-[400px]">
        {safeStep === 1 && (
          <StepBrandBasics
            data={brand}
            onChange={setBrand}
            errors={brandErrors}
            onAutofill={handleAutofill}
          />
        )}
        {safeStep === 2 && (
          <StepCrawlWebsite
            domain={brand.domain}
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
            canSuggest={Boolean(projectId) && hasAvailableKnowledge}
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
            canSuggest={Boolean(projectId)}
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
          <StepReviewQuestions
            queries={generatedQueries}
            isGenerating={isGeneratingQueries}
            generateError={generateQueriesError}
            onQueriesChange={setGeneratedQueries}
            onRegenerate={handleRegenerateQueries}
          />
        )}
        {safeStep === 7 && (
          <StepReview
            brand={brand}
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
      {safeStep < TOTAL_STEPS && (
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
      {safeStep === TOTAL_STEPS && (
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
