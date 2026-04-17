import { useCallback, useState, type FormEvent } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { Loader2 } from "lucide-react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { AnalysisProgress } from "@/components/projects/analysis-progress";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useLocale } from "@/hooks/use-locale";
import { useCreateProject } from "@/hooks/use-projects";
import type { SiteAudit } from "@/hooks/use-site-audit";
import { apiPost } from "@/lib/api-client";
import { parseDashboardSearch } from "@/lib/dashboard-search";
import type { ProjectCreate } from "@/types/project";

export const Route = createFileRoute("/_dashboard/projects_/new")({
  component: NewProjectSimple,
  validateSearch: (search: Record<string, unknown>) =>
    parseDashboardSearch(search),
});

/** Returns homepage URL and domain for `ProjectCreate.domain`. */
function normalizeWebsiteInput(
  raw: string,
): { auditUrl: string; domain: string } | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;
  let urlStr = trimmed;
  if (!/^https?:\/\//i.test(urlStr)) {
    urlStr = `https://${urlStr}`;
  }
  try {
    const u = new URL(urlStr);
    if (!u.hostname) return null;
    const domain = u.hostname.replace(/^www\./i, "");
    const auditUrl = `${u.origin}/`;
    return { auditUrl, domain };
  } catch {
    return null;
  }
}

function NewProjectSimple() {
  const { t } = useTranslation("projects");
  const { locale } = useLocale();
  const navigate = useNavigate();
  const [name, setName] = useState("");
  const [website, setWebsite] = useState("");
  const [errors, setErrors] = useState<{ name?: string; website?: string }>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showProgress, setShowProgress] = useState(false);
  const [pendingNavigation, setPendingNavigation] = useState<string | null>(null);
  const createProject = useCreateProject();

  const handleProgressComplete = useCallback(async () => {
    if (pendingNavigation) {
      await navigate({
        to: "/projects/$projectId/site-audit",
        params: { projectId: pendingNavigation },
      });
    }
  }, [navigate, pendingNavigation]);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    const next: { name?: string; website?: string } = {};
    if (!name.trim()) {
      next.name = t("createFlow.nameRequired");
    }
    const parsed = normalizeWebsiteInput(website);
    if (!parsed) {
      next.website = t("createFlow.invalidUrl");
    }
    setErrors(next);
    if (Object.keys(next).length > 0) return;

    setIsSubmitting(true);
    try {
      const payload: ProjectCreate = {
        name: name.trim(),
        client_name: name.trim(),
        description: "",
        domain: parsed!.domain,
        content_locale: locale === "ru" ? "ru" : "en",
      };
      const project = await createProject.mutateAsync(payload);
      await apiPost<SiteAudit>(`/projects/${project.id}/site-audit`, {
        url: parsed!.auditUrl,
      });
      try {
        await apiPost(`/projects/${project.id}/runs/quick-start`, {});
      } catch {
        toast.error(t("createFlow.visibilityAnalyticsFailed"));
      }
      toast.success(t("createFlow.auditStarted"));
      setPendingNavigation(project.id);
      setShowProgress(true);
    } catch {
      toast.error(t("createFlow.createFailed"));
      setIsSubmitting(false);
    }
  }

  if (showProgress) {
    return (
      <AnalysisProgress
        projectName={name.trim() || undefined}
        onComplete={handleProgressComplete}
      />
    );
  }

  return (
    <div className="mx-auto max-w-lg space-y-8">
      <div>
        <h2 className="text-2xl font-bold text-foreground">
          {t("createFlow.title")}
        </h2>
        <p className="mt-1 text-sm text-muted-foreground">
          {t("createFlow.subtitle")}
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        <div className="space-y-2">
          <Label htmlFor="project-name">{t("projectEditor.fields.name")}</Label>
          <Input
            id="project-name"
            name="name"
            autoComplete="organization"
            placeholder={t("projectEditor.placeholders.name")}
            value={name}
            onChange={(e) => setName(e.target.value)}
            aria-invalid={Boolean(errors.name)}
          />
          {errors.name ? (
            <p className="text-sm text-destructive">{errors.name}</p>
          ) : null}
        </div>

        <div className="space-y-2">
          <Label htmlFor="project-website">{t("createFlow.websiteLabel")}</Label>
          <Input
            id="project-website"
            name="website"
            type="url"
            inputMode="url"
            autoComplete="url"
            placeholder={t("createFlow.websitePlaceholder")}
            value={website}
            onChange={(e) => setWebsite(e.target.value)}
            aria-invalid={Boolean(errors.website)}
          />
          {errors.website ? (
            <p className="text-sm text-destructive">{errors.website}</p>
          ) : null}
        </div>

        <Button
          type="submit"
          className="w-full sm:w-auto gap-2"
          disabled={isSubmitting}
        >
          {isSubmitting ? (
            <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
          ) : null}
          {isSubmitting
            ? t("createFlow.starting")
            : t("createFlow.startAudit")}
        </Button>
      </form>
    </div>
  );
}
