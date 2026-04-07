"use client";

import { Clipboard } from "lucide-react";
import {
  Card,
  CardHeader,
  CardTitle,
  CardContent,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";

interface EmbedCodePreviewProps {
  widgetId?: string;
}

export function EmbedCodePreview({ widgetId }: EmbedCodePreviewProps) {
  const code = `<script src="https://cdn.aeogeo.com/widget.js" data-id="wgt_${widgetId || "xxx"}"></script>`;

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(code);
    } catch {
      console.error("Failed to copy embed code");
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Embed Code</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="relative">
          <pre className="overflow-x-auto rounded-md bg-muted p-4">
            <code className="font-mono text-sm text-foreground">{code}</code>
          </pre>
          <Button
            variant="ghost"
            size="icon-sm"
            className="absolute right-2 top-2"
            onClick={handleCopy}
          >
            <Clipboard className="h-4 w-4" />
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
