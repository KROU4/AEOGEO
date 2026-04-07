/**
 * Convenience type aliases from the auto-generated OpenAPI types.
 *
 * Regenerate with: bun run generate:types
 */
import type { components } from "./api.generated";

// -- Generic pagination helper --
export type PaginatedResponse<T> = {
  items: T[];
  next_cursor: string | null;
  has_more: boolean;
};

// -- Concrete pagination schemas --
export type PaginatedProjects = components["schemas"]["PaginatedResponse_ProjectResponse_"];
export type PaginatedContent = components["schemas"]["PaginatedResponse_ContentResponse_"];
export type PaginatedKnowledgeEntries = components["schemas"]["PaginatedResponse_KnowledgeEntryResponse_"];
export type PaginatedQuerySets = components["schemas"]["PaginatedResponse_QuerySetResponse_"];
export type PaginatedQueries = components["schemas"]["PaginatedResponse_QueryResponse_"];
export type PaginatedRuns = components["schemas"]["PaginatedResponse_EngineRunResponse_"];
export type PaginatedAnswers = components["schemas"]["PaginatedResponse_AnswerResponse_"];
export type PaginatedReports = components["schemas"]["PaginatedResponse_ReportResponse_"];

// -- Auth --
export type User = components["schemas"]["UserResponse"];
export type BootstrapRequest = components["schemas"]["BootstrapRequest"];
export type MessageResponse = components["schemas"]["MessageResponse"];
export type InviteRequest = components["schemas"]["InviteRequest"];
export type InviteResponse = components["schemas"]["InviteResponse"];
export type TeamMember = components["schemas"]["TeamMemberResponse"];
export type TeamProjectMembership = components["schemas"]["TeamProjectMembershipResponse"];

// -- Projects --
export type Project = components["schemas"]["ProjectResponse"];
export type ProjectCreate = components["schemas"]["ProjectCreate"];
export type ProjectUpdate = components["schemas"]["ProjectUpdate"];
export type ProjectMember = components["schemas"]["ProjectMemberResponse"];
export type ProjectMemberAdd = components["schemas"]["ProjectMemberAdd"];

// -- Brand / knowledge --
export type Brand = components["schemas"]["BrandResponse"];
export type BrandCreate = components["schemas"]["BrandCreate"];
export type BrandUpdate = components["schemas"]["BrandUpdate"];
export type BrandAutofillRequest = components["schemas"]["BrandAutofillRequest"];
export type BrandAutofillResponse = components["schemas"]["BrandAutofillResponse"];
export type Product = components["schemas"]["ProductResponse"];
export type ProductCreate = components["schemas"]["ProductCreate"];
export type ProductUpdate = components["schemas"]["ProductUpdate"];
export type ProductSuggestionRequest = components["schemas"]["ProductSuggestionRequest"];
export type ProductSuggestion = components["schemas"]["ProductSuggestion"];
export type ProductSuggestionResponse = components["schemas"]["ProductSuggestionResponse"];
export type Competitor = components["schemas"]["CompetitorResponse"];
export type CompetitorCreate = components["schemas"]["CompetitorCreate"];
export type CompetitorUpdate = components["schemas"]["CompetitorUpdate"];
export type CompetitorSuggestionRequest = components["schemas"]["CompetitorSuggestionRequest"];
export type CompetitorSuggestion = components["schemas"]["CompetitorSuggestion"];
export type CompetitorSuggestionResponse = components["schemas"]["CompetitorSuggestionResponse"];
export type KnowledgeEntry = components["schemas"]["KnowledgeEntryResponse"];
export type KnowledgeEntryCreate = components["schemas"]["KnowledgeEntryCreate"];
export type KnowledgeEntryUpdate = components["schemas"]["KnowledgeEntryUpdate"];
export type CustomFile = components["schemas"]["CustomFileResponse"];
export type CrawlRequest = components["schemas"]["CrawlRequest"];
export type CrawlPagePreview = components["schemas"]["CrawlPagePreview"];
export type CrawlKnowledgePreview = components["schemas"]["CrawlKnowledgePreview"];
export type CrawlResponse = components["schemas"]["CrawlResponse"];
export type SemanticSearchRequest = components["schemas"]["SemanticSearchRequest"];

// -- Queries --
export type QuerySet = components["schemas"]["QuerySetResponse"];
export type QuerySetCreate = components["schemas"]["QuerySetCreate"];
export type QuerySetUpdate = components["schemas"]["QuerySetUpdate"];
export type Query = components["schemas"]["QueryResponse"];
export type QueryCreate = components["schemas"]["QueryCreate"];
export type QueryUpdate = components["schemas"]["QueryUpdate"];
export type QueryGenerateRequest = components["schemas"]["QueryGenerateRequest"];
export type BatchQueryStatusUpdate = components["schemas"]["BatchQueryStatusUpdate"];
export type QueryCluster = components["schemas"]["QueryClusterResponse"];

// -- Engines --
export type Engine = components["schemas"]["EngineResponse"];
export type EngineCreate = components["schemas"]["EngineCreate"];
export type EngineUpdate = components["schemas"]["EngineUpdate"];
export type Role = components["schemas"]["RoleResponse"];

// -- Runs / answers --
export type EngineRun = components["schemas"]["EngineRunResponse"];
export type EngineRunCreate = components["schemas"]["EngineRunCreate"];
export type EngineRunProgress = components["schemas"]["EngineRunProgress"];
export type Answer = components["schemas"]["AnswerResponse"];
export type AnswerDetail = components["schemas"]["AnswerDetail"];
export type Mention = components["schemas"]["MentionResponse"];
export type Citation = components["schemas"]["CitationResponse"];
export type AnswerVisibilityScore = components["schemas"]["VisibilityScoreResponse"];

// -- Dashboard / scoring --
export type DashboardVisibilityScore = components["schemas"]["VisibilityScore"];
export type ShareOfVoiceEntry = components["schemas"]["ShareOfVoiceEntry"];
export type SentimentBreakdown = components["schemas"]["SentimentBreakdown"];
export type CitationRate = components["schemas"]["CitationRate"];
export type ActivityItem = components["schemas"]["ActivityItem"];
export type RunSummary = components["schemas"]["RunSummaryResponse"];
export type ScoreByEngine = components["schemas"]["ScoreByEngineResponse"];
export type ScoreByQuery = components["schemas"]["ScoreByQueryResponse"];
export type ScoreTrend = components["schemas"]["ScoreTrendEntry"];
export type RunComparison = components["schemas"]["RunComparisonResponse"];

// -- Scheduled runs --
export type ScheduledRun = components["schemas"]["ScheduledRunResponse"];
export type ScheduledRunCreate = components["schemas"]["ScheduledRunCreate"];
export type ScheduledRunUpdate = components["schemas"]["ScheduledRunUpdate"];

// -- Admin / usage --
export type AIProviderKey = components["schemas"]["AIProviderKeyResponse"];
export type AIProviderKeyCreate = components["schemas"]["AIProviderKeyCreate"];
export type AIProviderKeyRotate = components["schemas"]["AIProviderKeyRotate"];
export type UsageSummary = components["schemas"]["UsageSummaryResponse"];
export type QuotaStatus = components["schemas"]["QuotaStatusResponse"];
export type ProviderUsage = components["schemas"]["ProviderUsageResponse"];
export type ModelUsage = components["schemas"]["ModelUsageResponse"];
export type TimeseriesPoint = components["schemas"]["TimeseriesPointResponse"];
export type UsageBreakdown = components["schemas"]["UsageBreakdownResponse"];
export type TenantUsageOverview = components["schemas"]["TenantUsageOverviewResponse"];
export type TenantUsageDetail = components["schemas"]["TenantUsageDetailResponse"];
export type TenantQuota = components["schemas"]["TenantQuotaResponse"];
export type TenantQuotaUpdate = components["schemas"]["TenantQuotaUpdate"];

// -- Content --
export type Content = components["schemas"]["ContentResponse"];
export type ContentCreate = components["schemas"]["ContentCreate"];
export type ContentUpdate = components["schemas"]["ContentUpdate"];
export type ContentGenerateRequest = components["schemas"]["ContentGenerateRequest"];
export type ContentTemplate = components["schemas"]["ContentTemplateResponse"];
export type ContentGenerateFromTemplate = components["schemas"]["ContentTemplateGenerateRequest"];

// -- Reports --
export type Report = components["schemas"]["ReportResponse"];
export type ReportCreate = components["schemas"]["ReportCreate"];
export type ShareLink = components["schemas"]["ShareLinkResponse"];

// -- Widgets / feedback --
export type Widget = components["schemas"]["WidgetResponse"];
export type WidgetCreate = components["schemas"]["WidgetCreate"];
export type WidgetUpdate = components["schemas"]["WidgetUpdate"];
export type EmbedCode = components["schemas"]["EmbedCodeResponse"];
export type FeedbackCreate = components["schemas"]["FeedbackCreate"];
export type Feedback = components["schemas"]["FeedbackResponse"];
export type FeedbackStats = components["schemas"]["FeedbackStats"];

export interface WidgetAnalyticsItem {
  content_id: string;
  title: string;
  interaction_count: number;
}

export interface WidgetAnalytics {
  impressions: number;
  item_interactions: number;
  top_content: WidgetAnalyticsItem[];
}

export interface WidgetEventCreate {
  event_type: "impression" | "item_interaction";
  session_id?: string | null;
  content_id?: string | null;
}
