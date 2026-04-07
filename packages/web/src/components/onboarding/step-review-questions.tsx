import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Loader2,
  RotateCcw,
  Trash2,
  AlertTriangle,
  MessageSquare,
} from "lucide-react";
import type { Query } from "@/types/query";

const CATEGORIES = ["brand", "product", "competitive", "informational"] as const;
const PRIORITIES = [1, 2, 3, 4, 5] as const;

interface StepReviewQuestionsProps {
  queries: Query[];
  isGenerating: boolean;
  generateError: string | null;
  onQueriesChange: (queries: Query[]) => void;
  onRegenerate: () => void;
}

export function StepReviewQuestions({
  queries,
  isGenerating,
  generateError,
  onQueriesChange,
  onRegenerate,
}: StepReviewQuestionsProps) {
  const { t } = useTranslation("onboarding");

  function updateQuery(id: string, updates: Partial<Query>) {
    onQueriesChange(
      queries.map((q) => (q.id === id ? { ...q, ...updates } : q)),
    );
  }

  function removeQuery(id: string) {
    onQueriesChange(queries.filter((q) => q.id !== id));
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="space-y-2">
        <div className="flex items-center gap-2">
          <MessageSquare className="h-5 w-5 text-teal-600" />
          <h3 className="text-lg font-semibold text-foreground">
            {t("reviewQuestions.title")}
          </h3>
        </div>
        <p className="text-sm text-muted-foreground">
          {t("reviewQuestions.description")}
        </p>
      </div>

      {/* Generating state */}
      {isGenerating && (
        <Card>
          <CardContent className="flex items-center justify-center gap-3 py-16">
            <Loader2 className="h-5 w-5 animate-spin text-teal-600" />
            <span className="text-sm text-muted-foreground">
              {t("reviewQuestions.generating")}
            </span>
          </CardContent>
        </Card>
      )}

      {/* Error state */}
      {!isGenerating && generateError && (
        <Card className="border-red-200 dark:border-red-800">
          <CardContent className="flex items-center justify-between gap-4 py-6">
            <div className="flex items-center gap-3">
              <AlertTriangle className="h-5 w-5 text-red-600" />
              <span className="text-sm text-red-700 dark:text-red-400">
                {generateError}
              </span>
            </div>
            <Button variant="outline" onClick={onRegenerate}>
              <RotateCcw className="h-4 w-4" />
              {t("reviewQuestions.regenerate")}
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Query list */}
      {!isGenerating && queries.length > 0 && (
        <>
          {/* Toolbar */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Badge variant="secondary">
                {t("reviewQuestions.queryCount", { count: queries.length })}
              </Badge>
              {queries.length < 3 && (
                <span className="text-xs text-amber-600 dark:text-amber-400 flex items-center gap-1">
                  <AlertTriangle className="h-3 w-3" />
                  {t("reviewQuestions.minWarning")}
                </span>
              )}
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={onRegenerate}
              disabled={isGenerating}
            >
              {isGenerating ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <RotateCcw className="h-4 w-4" />
              )}
              {t("reviewQuestions.regenerate")}
            </Button>
          </div>

          {/* Query cards */}
          <div className="space-y-3">
            {queries.map((query) => (
              <QueryCard
                key={query.id}
                query={query}
                onUpdate={(updates) => updateQuery(query.id, updates)}
                onRemove={() => removeQuery(query.id)}
              />
            ))}
          </div>
        </>
      )}

      {/* Empty state */}
      {!isGenerating && !generateError && queries.length === 0 && (
        <Card>
          <CardContent className="py-12 text-center">
            <p className="text-sm text-muted-foreground mb-4">
              {t("reviewQuestions.emptyState")}
            </p>
            <Button variant="outline" onClick={onRegenerate}>
              <RotateCcw className="h-4 w-4" />
              {t("reviewQuestions.regenerate")}
            </Button>
          </CardContent>
        </Card>
      )}

      <p className="text-xs text-muted-foreground">
        {t("reviewQuestions.skipHint")}
      </p>
    </div>
  );
}

function QueryCard({
  query,
  onUpdate,
  onRemove,
}: {
  query: Query;
  onUpdate: (updates: Partial<Query>) => void;
  onRemove: () => void;
}) {
  const { t } = useTranslation("onboarding");
  const [editing, setEditing] = useState(false);
  const [editText, setEditText] = useState(query.text);

  function commitEdit() {
    const trimmed = editText.trim();
    if (trimmed && trimmed !== query.text) {
      onUpdate({ text: trimmed });
    }
    setEditing(false);
  }

  return (
    <Card>
      <CardContent className="flex items-start gap-3 py-3 px-4">
        {/* Priority indicator */}
        <div className="flex flex-col items-center gap-0.5 pt-1.5">
          <span className="text-xs text-muted-foreground">P{query.priority}</span>
          <Select
            value={String(query.priority)}
            onValueChange={(val) => onUpdate({ priority: Number(val) })}
          >
            <SelectTrigger className="h-6 w-12 text-xs px-1.5 border-0 bg-transparent shadow-none">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {PRIORITIES.map((p) => (
                <SelectItem key={p} value={String(p)}>
                  P{p}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Main content */}
        <div className="flex-1 min-w-0 space-y-2">
          {editing ? (
            <Input
              value={editText}
              onChange={(e) => setEditText(e.target.value)}
              onBlur={commitEdit}
              onKeyDown={(e) => {
                if (e.key === "Enter") commitEdit();
                if (e.key === "Escape") {
                  setEditText(query.text);
                  setEditing(false);
                }
              }}
              autoFocus
              className="text-sm"
            />
          ) : (
            <button
              type="button"
              onClick={() => {
                setEditText(query.text);
                setEditing(true);
              }}
              className="text-sm text-foreground text-left hover:text-teal-700 dark:hover:text-teal-400 transition-colors cursor-text w-full"
            >
              {query.text}
            </button>
          )}

          <div className="flex items-center gap-2">
            <Select
              value={query.category}
              onValueChange={(val) => onUpdate({ category: val })}
            >
              <SelectTrigger className="h-7 w-auto text-xs gap-1 border-0 bg-muted/50 shadow-none px-2">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {CATEGORIES.map((cat) => (
                  <SelectItem key={cat} value={cat}>
                    {t(`reviewQuestions.categories.${cat}`)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Remove button */}
        <Button
          variant="ghost"
          size="icon-xs"
          onClick={onRemove}
          className="text-muted-foreground hover:text-red-600 shrink-0 mt-1"
        >
          <Trash2 className="h-4 w-4" />
        </Button>
      </CardContent>
    </Card>
  );
}
