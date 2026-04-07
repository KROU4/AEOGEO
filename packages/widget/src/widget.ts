import type { WidgetConfig, WidgetData } from "./types";
import { fetchWidgetContent, sendWidgetEvent } from "./api";
import { renderFaq } from "./renderers/faq";
import { renderBlogFeed } from "./renderers/blog-feed";
import { injectJsonLd } from "./renderers/json-ld";

import baseStyles from "./styles/base.css?inline";
import lightTheme from "./styles/themes/light.css?inline";
import darkTheme from "./styles/themes/dark.css?inline";

export class AeogeoWidget {
  private el: HTMLElement;
  private shadow: ShadowRoot;
  private config: WidgetConfig;
  private container: HTMLElement;
  private themeStyle: HTMLStyleElement | null = null;

  constructor(element: HTMLElement) {
    this.el = element;
    this.config = this.readConfig();
    this.shadow = element.attachShadow({ mode: "open" });
    this.container = document.createElement("div");
    this.container.classList.add("aeogeo-widget-root");
    this.shadow.appendChild(this.container);
  }

  async init(): Promise<void> {
    this.injectStyles();
    this.showLoading();

    try {
      const data = await fetchWidgetContent(this.config.key);
      const theme = this.config.theme || normalizeTheme(data.widget?.theme);
      if (theme) {
        this.applyTheme(theme);
      }
      this.container.innerHTML = "";

      const mode = this.config.mode || normalizeMode(data.widget?.mode) || "faq";
      const items = this.config.maxItems
        ? data.items.slice(0, this.config.maxItems)
        : data.items;

      this.render({ ...data, items }, mode);
      void this.trackEvent({ event_type: "impression" });

      if (data.json_ld) {
        injectJsonLd(data.json_ld, this.config.key);
      }

      this.appendPoweredBy();
    } catch (err) {
      this.showError(
        err instanceof Error ? err.message : "Failed to load widget",
      );
    }
  }

  private readConfig(): WidgetConfig {
    const key = this.el.getAttribute("data-key") || "";
    const theme = normalizeTheme(this.el.getAttribute("data-theme"));
    const mode = normalizeMode(this.el.getAttribute("data-mode"));
    const maxItemsAttr = this.el.getAttribute("data-max-items");
    const maxItems = maxItemsAttr ? parseInt(maxItemsAttr, 10) : undefined;

    return { key, theme, mode, maxItems };
  }

  private injectStyles(): void {
    if (!this.themeStyle) {
      this.themeStyle = document.createElement("style");
      this.shadow.insertBefore(this.themeStyle, this.shadow.firstChild);
    }

    this.applyTheme(this.config.theme || "light");

    const baseStyle = document.createElement("style");
    baseStyle.textContent = baseStyles;
    this.shadow.appendChild(baseStyle);
  }

  private applyTheme(theme: "light" | "dark"): void {
    if (!this.themeStyle) {
      return;
    }

    this.themeStyle.textContent = theme === "dark" ? darkTheme : lightTheme;
  }

  private render(
    data: WidgetData,
    mode: string,
  ): void {
    if (data.items.length === 0) {
      this.showEmpty();
      return;
    }

    switch (mode) {
      case "blog_feed":
        renderBlogFeed(data.items, this.container, (itemId) => {
          void this.trackEvent({
            event_type: "item_interaction",
            content_id: itemId,
          });
        });
        break;
      case "faq":
      default:
        renderFaq(data.items, this.container, (itemId) => {
          void this.trackEvent({
            event_type: "item_interaction",
            content_id: itemId,
          });
        });
        break;
    }
  }

  private showLoading(): void {
    this.container.innerHTML = `
      <div class="aeogeo-loading">
        <div class="aeogeo-loading-spinner"></div>
        Loading...
      </div>
    `;
  }

  private showError(message: string): void {
    this.container.innerHTML = `
      <div class="aeogeo-error">${this.escapeHtml(message)}</div>
    `;
  }

  private showEmpty(): void {
    this.container.innerHTML = `
      <div class="aeogeo-loading">No published content available yet.</div>
    `;
  }

  private appendPoweredBy(): void {
    const footer = document.createElement("div");
    footer.classList.add("aeogeo-powered");
    footer.innerHTML = `Powered by <a href="https://sand-source.com" target="_blank" rel="noopener">AEOGEO</a>`;
    this.container.appendChild(footer);
  }

  private escapeHtml(str: string): string {
    const div = document.createElement("div");
    div.textContent = str;
    return div.innerHTML;
  }

  private async trackEvent(input: {
    event_type: "impression" | "item_interaction";
    content_id?: string;
  }): Promise<void> {
    if (!this.config.key) {
      return;
    }

    try {
      await sendWidgetEvent(this.config.key, {
        ...input,
        session_id: getWidgetSessionId(),
      });
    } catch {
      // Ignore analytics failures so widgets still render.
    }
  }
}

function normalizeTheme(value: string | null | undefined): "light" | "dark" | undefined {
  if (value === "light" || value === "dark") {
    return value;
  }
  return undefined;
}

function normalizeMode(value: string | null | undefined): "faq" | "blog_feed" | undefined {
  if (value === "faq" || value === "blog_feed") {
    return value;
  }
  return undefined;
}

function getWidgetSessionId(): string {
  if (typeof window === "undefined") {
    return "server";
  }

  try {
    const storageKey = "aeogeo_widget_session_id";
    const existing = window.sessionStorage.getItem(storageKey);
    if (existing) {
      return existing;
    }

    const next =
      typeof crypto !== "undefined" && "randomUUID" in crypto
        ? crypto.randomUUID()
        : `widget-${Date.now()}`;
    window.sessionStorage.setItem(storageKey, next);
    return next;
  } catch {
    return `widget-${Date.now()}`;
  }
}
