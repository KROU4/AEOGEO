import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Check, Copy, Code2 } from "lucide-react";

interface JsonLdPreviewProps {
  jsonLd: string;
  compact?: boolean;
}

function formatJsonLd(raw: string): string {
  try {
    const parsed = JSON.parse(raw);
    return JSON.stringify(parsed, null, 2);
  } catch {
    return raw;
  }
}

export function JsonLdPreview({ jsonLd, compact = false }: JsonLdPreviewProps) {
  const { t } = useTranslation("content");
  const [copied, setCopied] = useState(false);

  const formatted = formatJsonLd(jsonLd);

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(formatted);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard API not available
    }
  }

  if (compact) {
    return (
      <div className="relative group">
        <div className="max-h-40 overflow-y-auto rounded-md border bg-muted/30">
          <pre className="p-3 text-xs font-mono text-foreground/80 whitespace-pre-wrap break-all">
            {formatted}
          </pre>
        </div>
        <Button
          variant="ghost"
          size="icon-xs"
          className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity"
          onClick={handleCopy}
        >
          {copied ? (
            <Check className="h-3 w-3 text-green-600" />
          ) : (
            <Copy className="h-3 w-3" />
          )}
        </Button>
      </div>
    );
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Code2 className="h-4 w-4 text-teal-600" />
            <CardTitle className="text-sm">
              {t("jsonLd.title")}
            </CardTitle>
          </div>
          <Button variant="outline" size="sm" onClick={handleCopy}>
            {copied ? (
              <>
                <Check className="h-3.5 w-3.5 text-green-600" />
                {t("jsonLd.copied")}
              </>
            ) : (
              <>
                <Copy className="h-3.5 w-3.5" />
                {t("jsonLd.copy")}
              </>
            )}
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        <div className="max-h-80 overflow-y-auto rounded-md border bg-muted/30">
          <pre className="p-4 text-xs font-mono text-foreground/80 whitespace-pre-wrap break-all">
            {formatted}
          </pre>
        </div>
      </CardContent>
    </Card>
  );
}
