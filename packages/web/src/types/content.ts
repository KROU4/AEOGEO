export type {
  Content,
  ContentCreate,
  ContentUpdate,
  ContentGenerateRequest,
  ContentTemplate,
  ContentGenerateFromTemplate,
} from "./api";

// Keep the union types for local use — the generated schema uses plain `string`
export type ContentStatus = "draft" | "review" | "published" | "archived";
export type ContentType = "faq" | "blog" | "comparison" | "buyer_guide" | "pricing_clarifier" | "glossary";
