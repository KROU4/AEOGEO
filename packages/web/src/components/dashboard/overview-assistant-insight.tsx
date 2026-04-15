import { useCallback, useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { Loader2, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { ApiError } from "@/lib/api-client";
import { streamAssistantSummary } from "@/lib/assistant-stream";

interface OverviewAssistantInsightProps {
  projectId: string;
}

export function OverviewAssistantInsight({ projectId }: OverviewAssistantInsightProps) {
  const { t } = useTranslation("dashboard");
  const [text, setText] = useState("");
  const [phase, setPhase] = useState<
    "loading" | "streaming" | "done" | "empty" | "error"
  >("loading");
  const [errorCode, setErrorCode] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  const load = useCallback(() => {
    abortRef.current?.abort();
    abortRef.current = new AbortController();
    setText("");
    setErrorCode(null);
    setPhase("loading");

    void (async () => {
      try {
        setPhase("streaming");
        await streamAssistantSummary(
          projectId,
          {},
          (chunk) => setText((prev) => prev + chunk),
          abortRef.current?.signal,
        );
        setPhase("done");
      } catch (e) {
        if (e instanceof ApiError) {
          setErrorCode(e.code);
          const msg = String(e.code);
          if (
            e.status === 404 ||
            msg.includes("No completed") ||
            msg === "Not Found"
          ) {
            setPhase("empty");
            return;
          }
        }
        setPhase("error");
      }
    })();
  }, [projectId]);

  useEffect(() => {
    load();
    return () => {
      abortRef.current?.abort();
    };
  }, [load]);

  const showPulse =
    phase === "loading" || (phase === "streaming" && text.length === 0);

  return (
    <Card className="border-primary/20 bg-gradient-to-br from-primary/5 to-transparent">
      <CardContent className="pt-6">
        <div className="flex items-start gap-3">
          <div
            className={`mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary/15 text-primary ${
              showPulse ? "animate-pulse" : ""
            }`}
          >
            {phase === "loading" || (phase === "streaming" && !text) ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Sparkles className="h-4 w-4" />
            )}
          </div>
          <div className="min-w-0 flex-1 space-y-2">
            <p className="text-sm font-semibold text-foreground">
              {t("assistantInsight.title")}
            </p>
            {phase === "empty" && (
              <p className="text-sm text-muted-foreground">{t("assistantInsight.empty")}</p>
            )}
            {phase === "error" && (
              <div className="space-y-2">
                <p className="text-sm text-destructive">
                  {errorCode === "usage.limit_reached"
                    ? t("assistantInsight.errorLimit")
                    : errorCode === "ai_key.not_found"
                      ? t("assistantInsight.errorNoKey")
                      : t("assistantInsight.error")}
                </p>
                <Button variant="outline" size="sm" onClick={load}>
                  {t("assistantInsight.retry")}
                </Button>
              </div>
            )}
            {(phase === "streaming" || phase === "done") && text.length > 0 && (
              <p className="text-sm leading-relaxed text-foreground whitespace-pre-wrap">
                {text}
              </p>
            )}
            {phase === "streaming" && text.length === 0 && (
              <p className="text-sm text-muted-foreground">{t("assistantInsight.loading")}</p>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
