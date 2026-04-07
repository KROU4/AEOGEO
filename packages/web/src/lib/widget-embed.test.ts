import { describe, expect, it } from "vitest";
import {
  buildWidgetEmbedUrl,
  buildWidgetIframeCode,
  buildWidgetJsSnippet,
  buildWidgetScriptUrl,
  WIDGET_PUBLIC_ORIGIN,
} from "./widget-embed";

const widget = {
  name: "Widget",
  embed_token: "wk_123",
  theme: "dark",
  mode: "faq",
  max_items: 5,
  border_radius: 12,
} as const;

describe("widget embed helpers", () => {
  it("builds canonical public widget URLs", () => {
    expect(buildWidgetScriptUrl()).toBe(`${WIDGET_PUBLIC_ORIGIN}/widget.js`);
    expect(buildWidgetEmbedUrl(widget.embed_token)).toBe(
      `${WIDGET_PUBLIC_ORIGIN}/embed/${widget.embed_token}`,
    );
  });

  it("uses embed_token instead of internal widget ids in generated snippets", () => {
    expect(buildWidgetJsSnippet(widget)).toContain('data-key="wk_123"');
    expect(buildWidgetJsSnippet(widget)).toContain(
      '<script src="https://sand-source.com/widget.js" defer></script>',
    );
    expect(buildWidgetIframeCode(widget)).toContain(
      'src="https://sand-source.com/embed/wk_123"',
    );
  });
});
