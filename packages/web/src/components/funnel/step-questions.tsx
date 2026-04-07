import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { Loader2, ArrowLeft } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { apiPost } from "@/lib/api-client";
import type { Query, QuerySet } from "@/types/query";

interface StepQuestionsProps {
  projectId: string;
  onContinue: (querySetId: string) => void;
  onBack: () => void;
}

const QUERY_SET_NAME = "Starter Visibility Queries";
const QUERY_SET_DESCRIPTION = "Starter AI visibility queries generated during onboarding.";

export function StepQuestions({ projectId, onContinue, onBack }: StepQuestionsProps) {
  const { t } = useTranslation("funnel");
  const [queries, setQueries] = useState<Query[]>([]);
  const [querySetId, setQuerySetId] = useState<string | null>(null);
  const [isGenerating, setIsGenerating] = useState(true);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const started = useRef(false);

  useEffect(() => {
    if (started.current) return;
    started.current = true;

    (async () => {
      try {
        // Create query set
        const querySet = await apiPost<QuerySet>(
          `/projects/${projectId}/query-sets`,
          { name: QUERY_SET_NAME, description: QUERY_SET_DESCRIPTION },
        );
        setQuerySetId(querySet.id);

        // Generate queries
        const result = await apiPost<{ generated: number; queries: Query[] }>(
          `/projects/${projectId}/query-sets/${querySet.id}/generate`,
          { count: 10 },
        );

        setQueries(result.queries);
        setSelected(new Set(result.queries.map((q) => q.id)));
        setIsGenerating(false);
      } catch {
        toast.error("Failed to generate questions");
        setIsGenerating(false);
      }
    })();
  }, []);

  const toggleQuery = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleAll = () => {
    if (selected.size === queries.length) {
      setSelected(new Set());
    } else {
      setSelected(new Set(queries.map((q) => q.id)));
    }
  };

  const handleContinue = () => {
    if (querySetId) onContinue(querySetId);
  };

  return (
    <div className="w-full space-y-8 text-center">
      <div>
        <h1 className="text-2xl font-bold">{t("questions.heading")}</h1>
        <p className="mt-2 text-muted-foreground">{t("questions.description")}</p>
      </div>

      {isGenerating ? (
        <div className="flex items-center justify-center gap-2 text-muted-foreground">
          <Loader2 className="h-5 w-5 animate-spin" />
          <span>{t("questions.generating")}</span>
        </div>
      ) : (
        <div className="mx-auto max-w-lg space-y-3 text-left">
          <div className="flex items-center justify-between">
            <p className="text-sm text-muted-foreground">
              {t("questions.questionCount", { count: selected.size })}
            </p>
            <Button variant="ghost" size="sm" onClick={toggleAll}>
              {t("questions.toggleAll")}
            </Button>
          </div>

          <div className="max-h-80 space-y-1 overflow-y-auto rounded-lg border p-3">
            {queries.map((query) => (
              <label
                key={query.id}
                className="flex cursor-pointer items-start gap-3 rounded-md p-2 hover:bg-muted/50"
              >
                <Checkbox
                  checked={selected.has(query.id)}
                  onCheckedChange={() => toggleQuery(query.id)}
                  className="mt-0.5"
                />
                <span className="text-sm">{query.text}</span>
              </label>
            ))}
          </div>
        </div>
      )}

      <div className="flex items-center justify-center gap-3">
        <Button variant="outline" onClick={onBack}>
          <ArrowLeft className="mr-2 h-4 w-4" />
          {t("navigation.back")}
        </Button>
        <Button
          size="lg"
          onClick={handleContinue}
          disabled={isGenerating || selected.size === 0}
        >
          {t("navigation.continue")}
        </Button>
      </div>
    </div>
  );
}
