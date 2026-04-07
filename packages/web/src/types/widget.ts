export type {
  Widget,
  WidgetCreate,
  WidgetUpdate,
  EmbedCode,
  WidgetAnalytics,
  WidgetAnalyticsItem,
  WidgetEventCreate,
  FeedbackCreate,
  Feedback as FeedbackEntry,
  FeedbackStats,
} from "./api";

// Keep union types for local use — the generated schema uses plain `string`
export type WidgetMode = "faq" | "blog_feed";
export type WidgetTheme = "light" | "dark";
export type WidgetPosition = "bottom-right" | "bottom-left" | "top-right" | "top-left" | "inline";
export type FeedbackType = "like" | "dislike";
export type FeedbackEntityType = "content" | "answer";
