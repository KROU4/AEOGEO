import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiGet, apiPost, apiPut, apiDelete } from "@/lib/api-client";
import type {
  Brand,
  BrandCreate,
  BrandUpdate,
  Product,
  ProductCreate,
  ProductSuggestionRequest,
  ProductSuggestionResponse,
  Competitor,
  CompetitorCreate,
  CompetitorSuggestionRequest,
  CompetitorSuggestionResponse,
  KnowledgeEntry,
  KnowledgeEntryCreate,
  KnowledgeEntryUpdate,
  CustomFile,
  CrawlRequest,
  CrawlResponse,
  SemanticSearchResult,
  SemanticSearchRequest,
} from "@/types/brand";
import type { PaginatedResponse } from "@/types/api";

// -- Brand --

export function useBrand(projectId: string) {
  return useQuery({
    queryKey: ["brand", projectId],
    queryFn: () => apiGet<Brand>(`/projects/${projectId}/brand`),
    enabled: !!projectId,
  });
}

export function useUpdateBrand(projectId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: BrandCreate | BrandUpdate) =>
      apiPut<Brand>(`/projects/${projectId}/brand`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["brand", projectId] });
      queryClient.invalidateQueries({ queryKey: ["knowledge", projectId] });
      queryClient.invalidateQueries({ queryKey: ["files", projectId] });
    },
  });
}

// -- Products --

export function useProducts(projectId: string) {
  return useQuery({
    queryKey: ["products", projectId],
    queryFn: () =>
      apiGet<Product[]>(`/projects/${projectId}/brand/products`),
    enabled: !!projectId,
  });
}

export function useCreateProduct(projectId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: ProductCreate) =>
      apiPost<Product>(`/projects/${projectId}/brand/products`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["products", projectId] });
    },
  });
}

export function useDeleteProduct(projectId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (productId: string) =>
      apiDelete(`/projects/${projectId}/brand/products/${productId}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["products", projectId] });
    },
  });
}

export function useSuggestProducts(projectId: string) {
  return useMutation({
    mutationFn: (data: ProductSuggestionRequest) =>
      apiPost<ProductSuggestionResponse>(
        `/projects/${projectId}/brand/products/suggest`,
        data
      ),
  });
}

// -- Competitors --

export function useCompetitors(projectId: string) {
  return useQuery({
    queryKey: ["competitors", projectId],
    queryFn: () =>
      apiGet<Competitor[]>(
        `/projects/${projectId}/brand/competitors`
      ),
    enabled: !!projectId,
  });
}

export function useCreateCompetitor(projectId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: CompetitorCreate) =>
      apiPost<Competitor>(`/projects/${projectId}/brand/competitors`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["competitors", projectId] });
    },
  });
}

export function useDeleteCompetitor(projectId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (competitorId: string) =>
      apiDelete(`/projects/${projectId}/brand/competitors/${competitorId}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["competitors", projectId] });
    },
  });
}

export function useSuggestCompetitors(projectId: string) {
  return useMutation({
    mutationFn: (data: CompetitorSuggestionRequest) =>
      apiPost<CompetitorSuggestionResponse>(
        `/projects/${projectId}/brand/competitors/suggest`,
        data
      ),
  });
}

// -- Knowledge / crawl (backend removed; stubs keep onboarding from crashing) --

const _emptyKnowledgePage = (): Promise<PaginatedResponse<KnowledgeEntry>> =>
  Promise.resolve({ items: [], next_cursor: null, has_more: false });

const _emptyCrawlResponse = (): CrawlResponse => ({
  entries_created: 0,
  extraction_errors: 0,
  pages_crawled: 0,
  total_pages: 0,
  knowledge_entries: [],
  pages: [],
});

export function useKnowledgeEntries(projectId: string) {
  return useQuery({
    queryKey: ["knowledge", projectId],
    queryFn: _emptyKnowledgePage,
    enabled: !!projectId,
  });
}

export function useCreateKnowledgeEntry(projectId: string) {
  return useMutation({
    mutationFn: async (_data: KnowledgeEntryCreate) => {
      void projectId;
      throw new Error("Knowledge base is not available in this product.");
    },
  });
}

export function useUpdateKnowledgeEntry(projectId: string) {
  return useMutation({
    mutationFn: async (_args: {
      entryId: string;
      data: KnowledgeEntryUpdate;
    }) => {
      void projectId;
      throw new Error("Knowledge base is not available in this product.");
    },
  });
}

export function useDeleteKnowledgeEntry(projectId: string) {
  return useMutation({
    mutationFn: async (_entryId: string) => {
      void projectId;
      throw new Error("Knowledge base is not available in this product.");
    },
  });
}

export function useUploadFile(projectId: string) {
  return useMutation({
    mutationFn: async (_file: File) => {
      void projectId;
      throw new Error("Knowledge base is not available in this product.");
    },
  });
}

export function useProjectFiles(projectId: string) {
  return useQuery({
    queryKey: ["files", projectId],
    queryFn: (): Promise<CustomFile[]> => Promise.resolve([]),
    enabled: !!projectId,
  });
}

export function useDeleteProjectFile(projectId: string) {
  return useMutation({
    mutationFn: async (_fileId: string) => {
      void projectId;
      throw new Error("Knowledge base is not available in this product.");
    },
  });
}

export function useCrawlWebsite(projectId: string) {
  return useMutation({
    mutationFn: async (_data: CrawlRequest): Promise<CrawlResponse> => {
      void projectId;
      void _data;
      return _emptyCrawlResponse();
    },
  });
}

export function useSemanticSearch(projectId: string) {
  return useMutation({
    mutationFn: async (_data: SemanticSearchRequest): Promise<SemanticSearchResult[]> => {
      void projectId;
      return [];
    },
  });
}
