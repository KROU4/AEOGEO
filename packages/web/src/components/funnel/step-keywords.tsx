import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { Loader2, X, Plus, ArrowLeft } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  useKeywords,
  useGenerateKeywords,
  useCreateKeyword,
  useDeleteKeyword,
} from "@/hooks/use-keywords";

interface StepKeywordsProps {
  projectId: string;
  onContinue: () => void;
  onBack: () => void;
}

export function StepKeywords({ projectId, onContinue, onBack }: StepKeywordsProps) {
  const { t } = useTranslation("funnel");
  const { data: keywords, refetch } = useKeywords(projectId);
  const generate = useGenerateKeywords(projectId);
  const createKeyword = useCreateKeyword(projectId);
  const deleteKeyword = useDeleteKeyword(projectId);
  const [newKeyword, setNewKeyword] = useState("");
  const started = useRef(false);

  const isReady = !generate.isPending && (keywords?.length ?? 0) > 0;

  useEffect(() => {
    if (started.current || (keywords && keywords.length > 0)) return;
    started.current = true;

    generate.mutate(
      { max_keywords: 10 },
      {
        onSuccess: () => refetch(),
        onError: () => toast.error("Failed to generate keywords"),
      },
    );
  }, [keywords]);

  const handleAdd = async () => {
    if (!newKeyword.trim()) return;
    try {
      await createKeyword.mutateAsync({ keyword: newKeyword.trim() });
      setNewKeyword("");
    } catch {
      toast.error("Failed to add keyword");
    }
  };

  const handleRemove = async (id: string) => {
    try {
      await deleteKeyword.mutateAsync(id);
    } catch {
      toast.error("Failed to remove keyword");
    }
  };

  const categoryColors: Record<string, string> = {
    product: "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200",
    brand: "bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200",
    industry: "bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-200",
    competitor: "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200",
    informational: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200",
    general: "bg-stone-100 text-stone-800 dark:bg-stone-800 dark:text-stone-200",
  };

  return (
    <div className="w-full space-y-8 text-center">
      <div>
        <h1 className="text-2xl font-bold">{t("keywords.heading")}</h1>
        <p className="mt-2 text-muted-foreground">{t("keywords.description")}</p>
      </div>

      {generate.isPending ? (
        <div className="flex items-center justify-center gap-2 text-muted-foreground">
          <Loader2 className="h-5 w-5 animate-spin" />
          <span>{t("keywords.generating")}</span>
        </div>
      ) : (
        <div className="mx-auto max-w-lg space-y-4">
          {/* Add keyword input */}
          <div className="flex gap-2">
            <Input
              value={newKeyword}
              onChange={(e) => setNewKeyword(e.target.value)}
              placeholder={t("keywords.addPlaceholder")}
              onKeyDown={(e) => e.key === "Enter" && handleAdd()}
            />
            <Button
              variant="outline"
              size="icon"
              onClick={handleAdd}
              disabled={!newKeyword.trim() || createKeyword.isPending}
            >
              <Plus className="h-4 w-4" />
            </Button>
          </div>

          {/* Keywords list */}
          <div className="flex flex-wrap justify-center gap-2">
            {keywords?.map((kw) => (
              <Badge
                key={kw.id}
                variant="secondary"
                className={`gap-1 px-3 py-1.5 text-sm ${categoryColors[kw.category] || categoryColors.general}`}
              >
                {kw.keyword}
                <button
                  onClick={() => handleRemove(kw.id)}
                  className="ml-1 rounded-full hover:bg-black/10 dark:hover:bg-white/10"
                  title={t("keywords.removeTooltip")}
                >
                  <X className="h-3 w-3" />
                </button>
              </Badge>
            ))}
          </div>

          {keywords && (
            <p className="text-sm text-muted-foreground">
              {t("keywords.keywordCount", { count: keywords.length })}
            </p>
          )}
        </div>
      )}

      <div className="flex items-center justify-center gap-3">
        <Button variant="outline" onClick={onBack}>
          <ArrowLeft className="mr-2 h-4 w-4" />
          {t("navigation.back")}
        </Button>
        <Button size="lg" onClick={onContinue} disabled={!isReady}>
          {t("navigation.continue")}
        </Button>
      </div>
    </div>
  );
}
