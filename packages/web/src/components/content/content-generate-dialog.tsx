import { useEffect, useState } from "react";
import type { TFunction } from "i18next";
import { useTranslation } from "react-i18next";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Sparkles, Loader2, ArrowLeft, ArrowRight, Check } from "lucide-react";
import { TemplatePicker } from "./template-picker";
import { useProjects } from "@/hooks/use-projects";
import {
  useContentTemplates,
  useGenerateFromTemplate,
} from "@/hooks/use-content";
import { ApiError } from "@/lib/api-client";
import type { Content } from "@/types/content";

interface ContentGenerateDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  initialProjectId?: string;
  onGenerated?: (content: Content) => void;
}

type Step = 1 | 2;

const errorKeyByCode: Record<string, string> = {
  "ai.usage_limit_reached": "errors.usage.limit_reached",
  "ai.rate_limited": "errors.usage.rate_limited",
  "ai.no_api_key": "errors.ai_key.not_found",
};

function getErrorMessage(error: unknown, t: TFunction<"common">): string {
  if (error instanceof ApiError) {
    const key = errorKeyByCode[error.code] ?? `errors.${error.code}`;
    const translated = t(key);
    return translated === key ? t("errors.unknown") : translated;
  }

  return t("errors.unknown");
}

export function ContentGenerateDialog({
  open,
  onOpenChange,
  initialProjectId,
  onGenerated,
}: ContentGenerateDialogProps) {
  const { t } = useTranslation("content");
  const { t: tCommon } = useTranslation("common");
  const [step, setStep] = useState<Step>(1);
  const [selectedTemplateId, setSelectedTemplateId] = useState<string | null>(null);
  const [topic, setTopic] = useState("");
  const [extraContext, setExtraContext] = useState("");
  const [projectId, setProjectId] = useState("");

  const { data: projectsData } = useProjects();
  const { data: templates = [] } = useContentTemplates();
  const projects = projectsData?.items ?? [];
  const generateMutation = useGenerateFromTemplate();
  const resetGenerate = generateMutation.reset;

  useEffect(() => {
    if (open) {
      setProjectId(initialProjectId ?? "");
      resetGenerate();
    }
  }, [open, initialProjectId, resetGenerate]);

  function resetForm() {
    setStep(1);
    setSelectedTemplateId(null);
    setTopic("");
    setExtraContext("");
    setProjectId(initialProjectId ?? "");
  }

  function handleOpenChange(value: boolean) {
    if (!value) {
      resetForm();
      resetGenerate();
    }
    onOpenChange(value);
  }

  function handleNext() {
    if (step === 1 && selectedTemplateId) {
      setStep(2);
    }
  }

  function handleBack() {
    if (step === 2) {
      setStep(1);
    }
  }

  function handleGenerate() {
    if (!selectedTemplateId || !topic.trim() || !projectId) {
      return;
    }

    generateMutation.mutate(
      {
        projectId,
        request: {
          template_id: selectedTemplateId,
          topic: topic.trim(),
          extra_context: extraContext.trim() || undefined,
        },
      },
      {
        onSuccess: (content) => {
          onGenerated?.(content);
          handleOpenChange(false);
        },
      }
    );
  }

  const canProceedStep1 = selectedTemplateId !== null;
  const canGenerate = selectedTemplateId && topic.trim() && projectId;

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-teal-600" />
            {t("generate.title")}
          </DialogTitle>
          <DialogDescription>{t("generate.description")}</DialogDescription>
        </DialogHeader>

        <div className="flex items-center gap-2 px-1">
          <div
            className={
              "flex h-6 w-6 items-center justify-center rounded-full text-xs font-medium " +
              (step >= 1
                ? "bg-teal-100 text-teal-700 dark:bg-teal-900 dark:text-teal-300"
                : "bg-muted text-muted-foreground")
            }
          >
            {step > 1 ? <Check className="h-3.5 w-3.5" /> : "1"}
          </div>
          <div className="h-px flex-1 bg-border" />
          <div
            className={
              "flex h-6 w-6 items-center justify-center rounded-full text-xs font-medium " +
              (step >= 2
                ? "bg-teal-100 text-teal-700 dark:bg-teal-900 dark:text-teal-300"
                : "bg-muted text-muted-foreground")
            }
          >
            2
          </div>
        </div>

        {step === 1 && (
          <div className="space-y-4">
            <p className="text-sm font-medium text-foreground">
              {t("generate.selectTemplate")}
            </p>
            <TemplatePicker
              templates={templates}
              value={selectedTemplateId}
              onChange={setSelectedTemplateId}
            />
          </div>
        )}

        {step === 2 && (
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="generate-project">{t("generate.project")}</Label>
              <Select value={projectId} onValueChange={setProjectId}>
                <SelectTrigger id="generate-project" className="w-full">
                  <SelectValue placeholder={t("generate.selectProject")} />
                </SelectTrigger>
                <SelectContent>
                  {projects.map((project) => (
                    <SelectItem key={project.id} value={project.id}>
                      {project.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="generate-topic">{t("generate.topic")}</Label>
              <Input
                id="generate-topic"
                value={topic}
                onChange={(event) => setTopic(event.target.value)}
                placeholder={t("generate.topicPlaceholder")}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="generate-context">
                {t("generate.extraContext")}
              </Label>
              <Textarea
                id="generate-context"
                value={extraContext}
                onChange={(event) => setExtraContext(event.target.value)}
                placeholder={t("generate.extraContextPlaceholder")}
                className="min-h-20"
              />
              <p className="text-xs text-muted-foreground">
                {t("generate.extraContextHint")}
              </p>
            </div>
          </div>
        )}

        {generateMutation.error && (
          <div className="rounded-md border border-destructive/20 bg-destructive/5 px-3 py-2 text-sm text-destructive">
            {getErrorMessage(generateMutation.error, tCommon)}
          </div>
        )}

        <DialogFooter className="gap-2 sm:gap-0">
          {step === 2 && (
            <Button variant="ghost" onClick={handleBack} className="mr-auto">
              <ArrowLeft className="h-4 w-4" />
              {t("generate.back")}
            </Button>
          )}

          {step === 1 ? (
            <Button onClick={handleNext} disabled={!canProceedStep1}>
              {t("generate.next")}
              <ArrowRight className="h-4 w-4" />
            </Button>
          ) : (
            <Button
              onClick={handleGenerate}
              disabled={!canGenerate || generateMutation.isPending}
            >
              {generateMutation.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Sparkles className="h-4 w-4" />
              )}
              {t("generate.submit")}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
