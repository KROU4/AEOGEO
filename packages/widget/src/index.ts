import { AeogeoWidget } from "./widget";

function initWidgets(): void {
  document.querySelectorAll<HTMLElement>("[data-aeogeo-widget]").forEach((el) => {
    if (el.hasAttribute("data-aeogeo-initialized")) return;
    el.setAttribute("data-aeogeo-initialized", "true");
    const widget = new AeogeoWidget(el);
    widget.init();
  });
}

// Initialize on DOM ready, or immediately if already loaded
if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", initWidgets);
} else {
  initWidgets();
}

// Re-scan for dynamically added widgets
if (typeof MutationObserver !== "undefined") {
  const observer = new MutationObserver((mutations) => {
    for (const mutation of mutations) {
      for (const node of mutation.addedNodes) {
        if (
          node instanceof HTMLElement &&
          (node.hasAttribute("data-aeogeo-widget") ||
            node.querySelector("[data-aeogeo-widget]"))
        ) {
          initWidgets();
          return;
        }
      }
    }
  });

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", () => {
      observer.observe(document.body, { childList: true, subtree: true });
    });
  } else {
    observer.observe(document.body, { childList: true, subtree: true });
  }
}

// Expose for manual initialization
(window as unknown as Record<string, unknown>).AeogeoWidget = { init: initWidgets };
