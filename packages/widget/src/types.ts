export interface WidgetConfig {
  key: string;
  theme?: "light" | "dark";
  mode?: "faq" | "blog_feed";
  maxItems?: number;
}

export interface ContentItem {
  id: string;
  title: string;
  body: string;
  content_type: string;
  published_at: string;
}

export interface WidgetData {
  items: ContentItem[];
  widget: {
    theme: string;
    mode: string;
  };
  json_ld?: string;
}

export interface WidgetEventCreate {
  event_type: "impression" | "item_interaction";
  session_id?: string | null;
  content_id?: string | null;
}
