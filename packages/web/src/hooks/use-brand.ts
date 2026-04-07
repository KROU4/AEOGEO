import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiGet, apiPost, apiPut, apiDelete, apiUpload } from "@/lib/api-client";
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

// -- Knowledge Entries --

export function useKnowledgeEntries(projectId: string) {
  return useQuery({
    queryKey: ["knowledge", projectId],
    queryFn: () =>
      apiGet<PaginatedResponse<KnowledgeEntry>>(
        `/projects/${projectId}/knowledge/entries`
      ),
    enabled: !!projectId,
  });
}

export function useCreateKnowledgeEntry(projectId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: KnowledgeEntryCreate) =>
      apiPost<KnowledgeEntry>(`/projects/${projectId}/knowledge/entries`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["knowledge", projectId] });
    },
  });
}

export function useUpdateKnowledgeEntry(projectId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      entryId,
      data,
    }: {
      entryId: string;
      data: KnowledgeEntryUpdate;
    }) =>
      apiPut<KnowledgeEntry>(
        `/projects/${projectId}/knowledge/entries/${entryId}`,
        data
      ),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["knowledge", projectId] });
    },
  });
}

export function useDeleteKnowledgeEntry(projectId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (entryId: string) =>
      apiDelete(`/projects/${projectId}/knowledge/entries/${entryId}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["knowledge", projectId] });
    },
  });
}

// -- File Uploads --

export function useUploadFile(projectId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (file: File) => {
      const formData = new FormData();
      formData.append("file", file);
      return apiUpload<CustomFile>(
        `/projects/${projectId}/knowledge/upload`,
        formData
      );
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["files", projectId] });
    },
  });
}

export function useProjectFiles(projectId: string) {
  return useQuery({
    queryKey: ["files", projectId],
    queryFn: () =>
      apiGet<CustomFile[]>(`/projects/${projectId}/knowledge/files`),
    enabled: !!projectId,
  });
}

export function useDeleteProjectFile(projectId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (fileId: string) =>
      apiDelete(`/projects/${projectId}/knowledge/files/${fileId}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["files", projectId] });
    },
  });
}

// -- Website Crawling --

export function useCrawlWebsite(projectId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: CrawlRequest) =>
      apiPost<CrawlResponse>(`/projects/${projectId}/knowledge/crawl`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["knowledge", projectId] });
    },
  });
}

// -- Semantic Search --

export function useSemanticSearch(projectId: string) {
  return useMutation({
    mutationFn: (data: SemanticSearchRequest) =>
      apiPost<SemanticSearchResult[]>(
        `/projects/${projectId}/knowledge/search`,
        data
      ),
  });
}
