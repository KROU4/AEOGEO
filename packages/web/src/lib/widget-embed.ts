import type { EmbedCode, Widget } from "@/types/widget";

export const WIDGET_PUBLIC_ORIGIN = "https://sand-source.com";

type WidgetLike = Pick<
  Widget,
  "name" | "embed_token" | "theme" | "mode" | "max_items" | "border_radius"
>;

export function buildWidgetScriptUrl(origin = WIDGET_PUBLIC_ORIGIN): string {
  return `${origin}/widget.js`;
}

export function buildWidgetEmbedUrl(
  embedToken: string,
  origin = WIDGET_PUBLIC_ORIGIN,
): string {
  return `${origin}/embed/${embedToken}`;
}

export function buildWidgetJsSnippet(
  widget: WidgetLike,
  embedCode?: EmbedCode | null,
  origin = WIDGET_PUBLIC_ORIGIN,
): string {
  if (embedCode?.js_snippet) {
    return embedCode.js_snippet;
  }

  return `<script src="${buildWidgetScriptUrl(origin)}" defer></script>
<div
  data-aeogeo-widget
  data-key="${widget.embed_token}"
  data-theme="${widget.theme}"
  data-mode="${widget.mode}"
  data-max-items="${widget.max_items}"
></div>`;
}

export function buildWidgetIframeCode(
  widget: WidgetLike,
  embedCode?: EmbedCode | null,
  origin = WIDGET_PUBLIC_ORIGIN,
): string {
  if (embedCode?.iframe) {
    return embedCode.iframe;
  }

  return `<iframe
  src="${buildWidgetEmbedUrl(widget.embed_token, origin)}"
  width="100%"
  height="600"
  frameborder="0"
  style="border: none; border-radius: ${widget.border_radius}px;"
  title="${widget.name}"
  loading="lazy"
></iframe>`;
}
