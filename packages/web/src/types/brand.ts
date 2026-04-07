import type { CrawlKnowledgePreview, CrawlPagePreview } from "./api";

export type {
  Brand,
  BrandCreate,
  BrandUpdate,
  BrandAutofillRequest,
  BrandAutofillResponse,
  Product,
  ProductCreate,
  ProductUpdate,
  ProductSuggestion,
  ProductSuggestionRequest,
  ProductSuggestionResponse,
  Competitor,
  CompetitorCreate,
  CompetitorUpdate,
  CompetitorSuggestion,
  CompetitorSuggestionRequest,
  CompetitorSuggestionResponse,
  KnowledgeEntry,
  KnowledgeEntryCreate,
  KnowledgeEntryUpdate,
  CustomFile,
  CrawlRequest,
  CrawlPagePreview,
  CrawlKnowledgePreview,
  CrawlResponse,
  SemanticSearchRequest,
} from "./api";

export type SemanticSearchResult = import("./api").KnowledgeEntry;

// Local onboarding draft state. These fields intentionally do not mirror the API.
export interface BrandProfileDraft {
  name: string;
  domain: string;
  description: string;
  industry: string;
  tone_of_voice: string;
  target_audience: string;
  unique_selling_points: string[];
}

export type CrawlStatus = "idle" | "crawling" | "processing" | "completed" | "error";

export interface CrawlJob {
  domain: string;
  status: CrawlStatus;
  pages_found: number;
  pages_crawled: number;
  entries_created: number;
  pages: CrawlPagePreview[];
  knowledge_entries: CrawlKnowledgePreview[];
  error_message: string | null;
  started_at: string;
  completed_at: string | null;
}
