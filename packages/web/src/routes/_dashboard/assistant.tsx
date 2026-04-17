import { useState, useRef, useEffect, useMemo } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Send, Plus } from "lucide-react";
import { toast } from "sonner";
import { useTranslation } from "react-i18next";
import { AnalyticsEmptyState, AnalyticsProjectBar } from "@/components/dashboard/analytics-project-bar";
import { useExplorerProjectId } from "@/hooks/use-explorer-project";
import { streamAssistantChat } from "@/lib/assistant-stream";
import { ApiError } from "@/lib/api-client";

export const Route = createFileRoute("/_dashboard/assistant")({
  component: AssistantPage,
});

interface Message {
  role: "user" | "assistant";
  content: string;
  timestamp: string;
}

const SUGGESTED_KEYS = ["suggested1", "suggested2", "suggested3", "suggested4"] as const;
const CONVERSATION_KEYS = ["conv1", "conv2", "conv3"] as const;

function AssistantPage() {
  const { t } = useTranslation("dashboard");
  const { projectId } = useExplorerProjectId();
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const conversations = useMemo(
    () => CONVERSATION_KEYS.map((k) => t(`stitch.assistant.${k}`)),
    [t],
  );
  const bottomRef = useRef<HTMLDivElement>(null);
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  useEffect(() => {
    if (!projectId) return;
    const now = new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
    setMessages([
      {
        role: "assistant",
        content: t("stitch.assistant.welcome"),
        timestamp: now,
      },
    ]);
  }, [projectId, t]);

  async function handleSend() {
    const text = input.trim();
    if (!text || loading || !projectId) return;

    const now = new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
    const history = messages
      .filter((m) => m.role === "user" || m.role === "assistant")
      .map((m) => ({ role: m.role, content: m.content }));

    setMessages((prev) => [...prev, { role: "user", content: text, timestamp: now }]);
    setInput("");
    setLoading(true);
    abortRef.current?.abort();
    abortRef.current = new AbortController();

    const assistantTs = new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
    setMessages((prev) => [...prev, { role: "assistant", content: "", timestamp: assistantTs }]);

    try {
      await streamAssistantChat(
        projectId,
        {
          message: text,
          history: history.slice(-20),
        },
        (chunk) => {
          setMessages((prev) => {
            const next = [...prev];
            const last = next[next.length - 1];
            if (last?.role === "assistant") {
              next[next.length - 1] = { ...last, content: last.content + chunk };
            }
            return next;
          });
        },
        abortRef.current.signal,
      );
    } catch (e) {
      if (e instanceof ApiError) {
        toast.error(e.message);
      } else if ((e as Error).name !== "AbortError") {
        toast.error(t("stitch.assistant.toastUnreachable"));
      }
      setMessages((prev) => prev.slice(0, -2));
    } finally {
      setLoading(false);
    }
  }

  if (!projectId) {
    return (
      <div className="space-y-6">
        <AnalyticsProjectBar />
        <AnalyticsEmptyState />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <AnalyticsProjectBar />
      <div className="flex h-[min(720px,calc(100vh-220px))] gap-4 min-h-0">
      <div className="w-60 shrink-0 flex flex-col gap-2">
        <Button variant="outline" size="sm" className="w-full justify-start gap-2" type="button" disabled>
          <Plus className="w-3.5 h-3.5" />
          {t("stitch.assistant.newChat")}
        </Button>
        <Card className="flex-1 overflow-hidden opacity-60">
          <CardHeader className="pb-2 pt-4 px-3">
            <CardTitle className="text-xs uppercase tracking-wider text-muted-foreground">{t("stitch.assistant.recent")}</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            {conversations.map((c, i) => (
              <button
                key={i}
                type="button"
                disabled
                className="w-full text-left px-3 py-2.5 text-xs text-muted-foreground border-b border-border/30 last:border-0"
              >
                {c}
              </button>
            ))}
          </CardContent>
        </Card>
      </div>

      <div className="flex flex-col flex-1 min-w-0 gap-3">
        <Card className="flex-1 overflow-y-auto">
          <CardContent className="p-5 space-y-4">
            {messages.length === 1 && (
              <div className="flex flex-wrap gap-2 pb-2">
                {SUGGESTED_KEYS.map((key) => (
                  <button
                    key={key}
                    type="button"
                    onClick={() => setInput(t(`stitch.assistant.${key}`))}
                    className="px-3 py-1.5 text-xs rounded-sm border border-border text-muted-foreground hover:text-foreground hover:border-primary/60 transition-colors"
                  >
                    {t(`stitch.assistant.${key}`)}
                  </button>
                ))}
              </div>
            )}

            {messages.map((msg, i) => (
              <div key={i} className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
                <div className={`max-w-[80%] ${msg.role === "user" ? "items-end" : "items-start"} flex flex-col gap-1`}>
                  <div
                    className={`rounded-sm px-4 py-3 text-sm leading-relaxed ${
                      msg.role === "user"
                        ? "bg-primary text-primary-foreground"
                        : "bg-[var(--avop-stitch-surface-container)] border border-border text-foreground"
                    }`}
                  >
                    {msg.content || (loading && i === messages.length - 1 ? "…" : "")}
                  </div>
                  <span className="text-[10px] text-muted-foreground px-1">{msg.timestamp}</span>
                </div>
              </div>
            ))}

            <div ref={bottomRef} />
          </CardContent>
        </Card>

        <div className="flex gap-2 shrink-0">
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                void handleSend();
              }
            }}
            placeholder={t("stitch.assistant.placeholder")}
            rows={2}
            className="flex-1 resize-none rounded-sm border border-border bg-card px-4 py-3 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary"
          />
          <Button onClick={() => void handleSend()} disabled={!input.trim() || loading} className="self-end h-10 px-4" type="button">
            <Send className="w-4 h-4" />
          </Button>
        </div>
        <p className="text-[10px] text-muted-foreground shrink-0">{t("stitch.assistant.footer")}</p>
      </div>
      </div>
    </div>
  );
}
