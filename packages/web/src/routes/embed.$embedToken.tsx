import { useEffect, useState } from "react";
import { createFileRoute, useParams } from "@tanstack/react-router";

declare global {
  interface Window {
    AeogeoWidget?: {
      init: () => void;
    };
  }
}

export const Route = createFileRoute("/embed/$embedToken")({
  component: PublicWidgetEmbedPage,
});

function PublicWidgetEmbedPage() {
  const { embedToken } = useParams({ from: "/embed/$embedToken" });
  const [scriptError, setScriptError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;

    const existingScript = document.querySelector<HTMLScriptElement>(
      'script[data-aeogeo-widget-script="true"]',
    );

    const initializeWidget = () => {
      if (!active) {
        return;
      }

      window.AeogeoWidget?.init();
    };

    if (existingScript) {
      if (window.AeogeoWidget) {
        initializeWidget();
      } else {
        existingScript.addEventListener("load", initializeWidget, { once: true });
      }

      return () => {
        active = false;
        existingScript.removeEventListener("load", initializeWidget);
      };
    }

    const script = document.createElement("script");
    script.src = "/widget.js";
    script.defer = true;
    script.dataset.aeogeoWidgetScript = "true";
    script.onload = initializeWidget;
    script.onerror = () => {
      if (active) {
        setScriptError("Failed to load widget.js");
      }
    };
    document.head.appendChild(script);

    return () => {
      active = false;
      script.onload = null;
      script.onerror = null;
    };
  }, [embedToken]);

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top,#f5fffd,transparent_50%),linear-gradient(180deg,#ffffff_0%,#f8fafc_100%)] p-4 sm:p-6">
      <div className="mx-auto max-w-4xl">
        <div
          className="rounded-3xl border border-slate-200 bg-white/90 p-3 shadow-[0_18px_60px_rgba(15,23,42,0.08)] backdrop-blur"
          data-aeogeo-widget
          data-key={embedToken}
        />
        {scriptError ? (
          <p className="mt-3 text-center text-sm text-rose-600">
            {scriptError}
          </p>
        ) : null}
      </div>
    </div>
  );
}
