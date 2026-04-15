import type { ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { Loader2 } from "lucide-react";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import type { BrandMentionSpan } from "@/hooks/use-project-answer";

function HighlightedAnswerBody({
  text,
  mentions,
}: {
  text: string;
  mentions: BrandMentionSpan[];
}) {
  const valid = mentions
    .filter((m) => m.start < m.end && m.end <= text.length)
    .sort((a, b) => a.start - b.start);

  const parts: ReactNode[] = [];
  let i = 0;
  let key = 0;
  for (const m of valid) {
    if (m.start > i) {
      parts.push(
        <span key={`t-${key++}`}>{text.slice(i, m.start)}</span>,
      );
    }
    parts.push(
      <mark
        key={`m-${m.start}-${m.end}-${key++}`}
        className="rounded bg-primary/25 px-0.5 text-foreground"
        title={m.brand}
      >
        {text.slice(m.start, m.end)}
      </mark>,
    );
    i = Math.max(i, m.end);
  }
  if (i < text.length) {
    parts.push(<span key={`t-${key++}`}>{text.slice(i)}</span>);
  }

  return (
    <div className="max-h-[60vh] overflow-y-auto whitespace-pre-wrap text-sm leading-relaxed">
      {parts.length > 0 ? parts : text}
    </div>
  );
}

interface PlatformAnswerSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  engine: string | null;
  queryText: string | null;
  rawText: string | null;
  brandMentions: BrandMentionSpan[] | undefined;
  isLoading: boolean;
  error: Error | null;
}

export function PlatformAnswerSheet({
  open,
  onOpenChange,
  engine,
  queryText,
  rawText,
  brandMentions,
  isLoading,
  error,
}: PlatformAnswerSheetProps) {
  const { t } = useTranslation("explorer");

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full overflow-y-auto sm:max-w-xl">
        <SheetHeader>
          <SheetTitle>{t("platforms.answerSheetTitle")}</SheetTitle>
          <SheetDescription className="line-clamp-3 text-left">
            {engine ? `${engine} · ` : ""}
            {queryText ?? "—"}
          </SheetDescription>
        </SheetHeader>
        <div className="mt-4">
          {isLoading ? (
            <div className="flex items-center gap-2 text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              <span className="text-sm">{t("platforms.answerLoading")}</span>
            </div>
          ) : error ? (
            <p className="text-sm text-destructive">{error.message}</p>
          ) : rawText ? (
            <HighlightedAnswerBody
              text={rawText}
              mentions={brandMentions ?? []}
            />
          ) : (
            <p className="text-sm text-muted-foreground">
              {t("platforms.answerEmpty")}
            </p>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}
