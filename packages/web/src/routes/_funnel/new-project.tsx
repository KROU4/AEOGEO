import { Fragment, useState } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Check } from "lucide-react";
import { useCreateProject } from "@/hooks/use-projects";
import type { ProjectCreate } from "@/types/project";

export const Route = createFileRoute("/_funnel/new-project")({
  component: OnboardingWizard,
});

interface WizardForm {
  name: string;
  url: string;
  competitors: string[];
  queries: string[];
  content_locale: string;
}

const TOTAL_STEPS = 5;

function normalizeWebsiteInput(raw: string): { domain: string } | null {
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
    return { domain };
  } catch {
    return null;
  }
}

function OnboardingWizard() {
  const { t } = useTranslation("funnel");
  const navigate = useNavigate();
  const createProject = useCreateProject();
  const [step, setStep] = useState(1);
  const [form, setForm] = useState<WizardForm>({
    name: "",
    url: "",
    competitors: [""],
    queries: [""],
    content_locale: "en",
  });

  const isStepValid = () => {
    if (step === 1) return form.name.trim().length > 0;
    return true;
  };

  async function handleCreate() {
    const parsed = normalizeWebsiteInput(form.url);
    const payload: ProjectCreate = {
      name: form.name.trim(),
      client_name: form.name.trim(),
      description: "",
      content_locale: form.content_locale === "ru" ? "ru" : "en",
      domain: parsed?.domain ?? null,
    };
    try {
      const result = await createProject.mutateAsync(payload);
      void navigate({ to: "/projects/$projectId", params: { projectId: result.id } });
    } catch {
      // Error handled by mutation
    }
  }

  return (
    <div className="max-w-xl mx-auto py-12 px-4 w-full">
      <div className="flex items-center gap-0 mb-12">
        {Array.from({ length: TOTAL_STEPS }, (_, i) => (
          <Fragment key={i}>
            <div
              className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold transition-all duration-200 shrink-0 ${
                i + 1 < step
                  ? "bg-primary text-primary-foreground"
                  : i + 1 === step
                    ? "bg-transparent text-primary border border-primary ring-2 ring-primary/20"
                    : "bg-muted text-muted-foreground"
              }`}
            >
              {i + 1 < step ? <Check className="w-3.5 h-3.5" /> : i + 1}
            </div>
            {i < TOTAL_STEPS - 1 && (
              <div
                className="flex-1 h-px transition-all duration-300"
                style={{ background: i + 1 < step ? "hsl(var(--primary))" : "hsl(var(--border))" }}
              />
            )}
          </Fragment>
        ))}
      </div>

      <div className="mb-8">
        <h2 className="text-2xl font-bold text-foreground" style={{ fontFamily: "var(--font-avop-display)" }}>
          {t(`quickOnboarding.step${step}.title`)}
        </h2>
        <p className="text-sm text-muted-foreground mt-1">{t(`quickOnboarding.step${step}.subtitle`)}</p>
      </div>

      {step === 1 && (
        <div className="space-y-5">
          <div className="space-y-2">
            <Label htmlFor="project-name">{t("quickOnboarding.step1.nameLabel")}</Label>
            <Input
              id="project-name"
              placeholder={t("quickOnboarding.step1.namePlaceholder")}
              value={form.name}
              onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
              autoFocus
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="project-url">{t("quickOnboarding.step1.urlLabel")}</Label>
            <Input
              id="project-url"
              placeholder={t("quickOnboarding.step1.urlPlaceholder")}
              value={form.url}
              onChange={(e) => setForm((f) => ({ ...f, url: e.target.value }))}
            />
          </div>
        </div>
      )}

      {step === 2 && (
        <div className="space-y-4">
          {form.competitors.map((c, i) => (
            <div key={i} className="flex gap-2">
              <Input
                placeholder={t("quickOnboarding.step2.competitorPlaceholder", { n: i + 1 })}
                value={c}
                onChange={(e) =>
                  setForm((f) => ({
                    ...f,
                    competitors: f.competitors.map((x, j) => (j === i ? e.target.value : x)),
                  }))
                }
              />
              {form.competitors.length > 1 && (
                <Button
                  variant="outline"
                  size="sm"
                  className="shrink-0"
                  type="button"
                  onClick={() => setForm((f) => ({ ...f, competitors: f.competitors.filter((_, j) => j !== i) }))}
                >
                  ×
                </Button>
              )}
            </div>
          ))}
          <Button variant="outline" size="sm" type="button" onClick={() => setForm((f) => ({ ...f, competitors: [...f.competitors, ""] }))}>
            {t("quickOnboarding.step2.addCompetitor")}
          </Button>
        </div>
      )}

      {step === 3 && (
        <div className="space-y-4">
          {form.queries.map((q, i) => (
            <div key={i} className="flex gap-2">
              <Input
                placeholder={t("quickOnboarding.step3.queryPlaceholder")}
                value={q}
                onChange={(e) =>
                  setForm((f) => ({
                    ...f,
                    queries: f.queries.map((x, j) => (j === i ? e.target.value : x)),
                  }))
                }
              />
              {form.queries.length > 1 && (
                <Button
                  variant="outline"
                  size="sm"
                  className="shrink-0"
                  type="button"
                  onClick={() => setForm((f) => ({ ...f, queries: f.queries.filter((_, j) => j !== i) }))}
                >
                  ×
                </Button>
              )}
            </div>
          ))}
          <Button variant="outline" size="sm" type="button" onClick={() => setForm((f) => ({ ...f, queries: [...f.queries, ""] }))}>
            {t("quickOnboarding.step3.addQuery")}
          </Button>
        </div>
      )}

      {step === 4 && (
        <div className="grid grid-cols-2 gap-3 max-w-xs">
          {[
            { code: "en", label: t("quickOnboarding.step4.langEn"), flag: "🇬🇧" },
            { code: "ru", label: t("quickOnboarding.step4.langRu"), flag: "🇷🇺" },
          ].map((lang) => (
            <button
              key={lang.code}
              type="button"
              onClick={() => setForm((f) => ({ ...f, content_locale: lang.code }))}
              className={`p-4 rounded-sm border text-left transition-colors ${
                form.content_locale === lang.code ? "border-primary bg-primary/5" : "border-border hover:bg-accent/50"
              }`}
            >
              <span className="text-xl">{lang.flag}</span>
              <p className="font-medium text-foreground text-sm mt-1">{lang.label}</p>
              {form.content_locale === lang.code && <Check className="w-3.5 h-3.5 text-primary mt-1" />}
            </button>
          ))}
        </div>
      )}

      {step === 5 && (
        <Card>
          <CardContent className="pt-5 pb-5 space-y-3">
            {(
              [
                [t("quickOnboarding.step5.labelName"), form.name || t("quickOnboarding.step5.dash")],
                [t("quickOnboarding.step5.labelWebsite"), form.url || t("quickOnboarding.step5.dash")],
                [t("quickOnboarding.step5.labelCompetitors"), String(form.competitors.filter(Boolean).length)],
                [t("quickOnboarding.step5.labelQueries"), String(form.queries.filter(Boolean).length)],
                [
                  t("quickOnboarding.step5.labelLanguage"),
                  form.content_locale === "en" ? t("quickOnboarding.step4.langEn") : t("quickOnboarding.step4.langRu"),
                ],
              ] as const
            ).map(([label, value], idx) => (
              <div
                key={idx}
                className="flex justify-between items-center text-sm py-1 border-b border-border/40 last:border-0"
              >
                <span className="text-muted-foreground">{label}</span>
                <span className="text-foreground font-medium">{value}</span>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      <div className="flex justify-between mt-10">
        <Button variant="outline" type="button" onClick={() => setStep((s) => s - 1)} disabled={step === 1}>
          {t("quickOnboarding.nav.back")}
        </Button>

        {step < TOTAL_STEPS ? (
          <Button type="button" onClick={() => setStep((s) => s + 1)} disabled={!isStepValid()}>
            {t("quickOnboarding.nav.continue")}
          </Button>
        ) : (
          <Button type="button" onClick={handleCreate} disabled={createProject.isPending || !form.name.trim()}>
            {createProject.isPending ? t("quickOnboarding.nav.creating") : t("quickOnboarding.nav.create")}
          </Button>
        )}
      </div>
    </div>
  );
}
