import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { Loader2, CheckCircle2, ArrowLeft } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { useKnowledgeEntries } from "@/hooks/use-brand";
import { useProject } from "@/hooks/use-projects";
import { apiPost, apiPut } from "@/lib/api-client";
import type { BrandAutofillResponse } from "@/types/brand";

interface StepKnowledgeProps {
  projectId: string;
  onContinue: () => void;
  onBack: () => void;
}

export function StepKnowledge({ projectId, onContinue, onBack }: StepKnowledgeProps) {
  const { t } = useTranslation("funnel");
  const { data: project } = useProject(projectId);
  const { data: knowledge, refetch } = useKnowledgeEntries(projectId);
  const [isDone, setIsDone] = useState(false);
  const [brandName, setBrandName] = useState<string | null>(null);
  const started = useRef(false);

  const entriesCount = knowledge?.items?.length ?? 0;

  useEffect(() => {
    if (started.current || !project?.domain) return;
    started.current = true;

    (async () => {
      try {
        // Auto-fill brand from website
        const autofill = await apiPost<BrandAutofillResponse>("/brand/autofill", {
          domain: project.domain,
          locale: project.content_locale || "en",
        });

        // Save brand to project
        await apiPut(`/projects/${projectId}/brand`, {
          name: autofill.name,
          description: autofill.description,
          website: project.domain,
          industry: autofill.industry,
          voice_guidelines: autofill.tone_of_voice,
          target_audience: autofill.target_audience,
          positioning: autofill.unique_selling_points?.join(". ") || "",
        });

        setBrandName(autofill.name);
        await refetch();
        setIsDone(true);
      } catch {
        toast.error("Failed to build knowledge set");
        setIsDone(true); // Allow continuing even on error
      }
    })();
  }, [project?.domain]);

  return (
    <div className="w-full space-y-8 text-center">
      <div>
        <h1 className="text-2xl font-bold">{t("knowledge.heading")}</h1>
        <p className="mt-2 text-muted-foreground">{t("knowledge.description")}</p>
      </div>

      <div className="mx-auto max-w-sm space-y-3">
        {!isDone ? (
          <div className="flex items-center justify-center gap-2 text-muted-foreground">
            <Loader2 className="h-5 w-5 animate-spin" />
            <span>{t("knowledge.building")}</span>
          </div>
        ) : (
          <div className="space-y-2">
            <div className="flex items-center justify-center gap-2 text-primary">
              <CheckCircle2 className="h-5 w-5" />
              <span className="font-medium">{t("knowledge.complete")}</span>
            </div>
            {brandName && (
              <p className="text-sm text-muted-foreground">
                {t("knowledge.brandExtracted")}: <strong>{brandName}</strong>
              </p>
            )}
            {entriesCount > 0 && (
              <p className="text-sm text-muted-foreground">
                {t("knowledge.entriesCount", { count: entriesCount })}
              </p>
            )}
          </div>
        )}
      </div>

      <div className="flex items-center justify-center gap-3">
        <Button variant="outline" onClick={onBack}>
          <ArrowLeft className="mr-2 h-4 w-4" />
          {t("navigation.back")}
        </Button>
        <Button size="lg" onClick={onContinue} disabled={!isDone}>
          {t("navigation.continue")}
        </Button>
      </div>
    </div>
  );
}
