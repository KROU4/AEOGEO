import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Copy, Check, Code, Frame } from "lucide-react";
import {
  buildWidgetIframeCode,
  buildWidgetJsSnippet,
} from "@/lib/widget-embed";
import type { Widget } from "@/types/widget";

interface EmbedCodeTabsProps {
  widget: Widget;
  embedCode?: { iframe: string; js_snippet: string } | null;
}

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  const { t } = useTranslation("common");

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Fallback for environments without clipboard API
      const textarea = document.createElement("textarea");
      textarea.value = text;
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand("copy");
      document.body.removeChild(textarea);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  return (
    <Button
      variant="outline"
      size="sm"
      onClick={handleCopy}
      className="shrink-0"
    >
      {copied ? (
        <Check className="w-3.5 h-3.5" />
      ) : (
        <Copy className="w-3.5 h-3.5" />
      )}
      {copied ? t("actions.copied") : t("actions.copy")}
    </Button>
  );
}

export function EmbedCodeTabs({ widget, embedCode }: EmbedCodeTabsProps) {
  const { t } = useTranslation("widgets");

  const jsSnippet = buildWidgetJsSnippet(widget, embedCode);
  const iframeCode = buildWidgetIframeCode(widget, embedCode);

  return (
    <Tabs defaultValue="js" className="w-full">
      <div className="flex items-center justify-between mb-3">
        <TabsList>
          <TabsTrigger value="js" className="gap-1.5">
            <Code className="w-3.5 h-3.5" />
            {t("embed.jsSnippet")}
          </TabsTrigger>
          <TabsTrigger value="iframe" className="gap-1.5">
            <Frame className="w-3.5 h-3.5" />
            {t("embed.iframe")}
          </TabsTrigger>
        </TabsList>
      </div>

      <TabsContent value="js">
        <div className="relative">
          <div className="flex justify-end mb-2">
            <CopyButton text={jsSnippet} />
          </div>
          <pre className="p-4 rounded-lg bg-secondary text-sm text-foreground overflow-x-auto font-mono leading-relaxed">
            <code>{jsSnippet}</code>
          </pre>
        </div>
      </TabsContent>

      <TabsContent value="iframe">
        <div className="relative">
          <div className="flex justify-end mb-2">
            <CopyButton text={iframeCode} />
          </div>
          <pre className="p-4 rounded-lg bg-secondary text-sm text-foreground overflow-x-auto font-mono leading-relaxed">
            <code>{iframeCode}</code>
          </pre>
        </div>
      </TabsContent>
    </Tabs>
  );
}
