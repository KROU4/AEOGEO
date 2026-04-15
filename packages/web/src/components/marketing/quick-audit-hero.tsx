import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Check, Loader2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ApiError, apiPatchPublic, apiPostPublic } from "@/lib/api-client";
import type { QuickAuditResult } from "@/types/quick-audit";
import { cn } from "@/lib/utils";

const BOT_ORDER = ["GPTBot", "ClaudeBot", "PerplexityBot"] as const;

function normalizeAuditUrl(raw: string): string {
  const u = raw.trim();
  if (!u) return "";
  if (!/^https?:\/\//i.test(u)) return `https://${u}`;
  return u;
}

type QuickAuditHeroProps = {
  /** Stitch hero: gradient glow + mono input row; results in glass panel below */
  landingInline?: boolean;
};

export function QuickAuditHero({ landingInline = false }: QuickAuditHeroProps) {
  const { t } = useTranslation("marketing");
  const [urlInput, setUrlInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<QuickAuditResult | null>(null);

  const [email, setEmail] = useState("");
  const [emailStatus, setEmailStatus] = useState<"idle" | "saving" | "saved" | "error">(
    "idle",
  );

  const runAudit = async () => {
    const url = normalizeAuditUrl(urlInput);
    if (url.length < 4) {
      setError(t("auditErrorShortUrl"));
      return;
    }
    setLoading(true);
    setError(null);
    setResult(null);
    setEmailStatus("idle");
    try {
      const data = await apiPostPublic<QuickAuditResult>("/audit/quick", {
        url,
        email: null,
      });
      setResult(data);
    } catch (e) {
      if (e instanceof ApiError && e.code === "audit.rate_limited") {
        setError(t("auditRateLimited"));
      } else if (e instanceof ApiError && e.code === "audit.invalid_url") {
        setError(t("auditErrorInvalid"));
      } else {
        setError(t("auditErrorGeneric"));
      }
    } finally {
      setLoading(false);
    }
  };

  const saveEmail = async () => {
    if (!result?.audit_id || !email.trim()) return;
    setEmailStatus("saving");
    try {
      await apiPatchPublic(`/audit/quick/${result.audit_id}/email`, {
        email: email.trim(),
      });
      setEmailStatus("saved");
    } catch {
      setEmailStatus("error");
    }
  };

  const registerHref = result
    ? `/register?audit_id=${encodeURIComponent(result.audit_id)}&site=${encodeURIComponent(
        normalizeAuditUrl(urlInput),
      )}`
    : "/register";

  const inputBlock = landingInline ? (
    <div className="relative max-w-lg group">
      <div className="absolute -inset-0.5 rounded-lg bg-gradient-to-r from-primary to-[#06b6d4] opacity-25 blur transition duration-1000 group-focus-within:opacity-50" />
      <div className="relative flex rounded-lg border border-[#3d494c]/50 bg-[#1b1c1d] p-1.5">
        <Input
          id="audit-url"
          type="url"
          inputMode="url"
          autoComplete="url"
          placeholder={t("auditHeroPlaceholder")}
          value={urlInput}
          onChange={(e) => setUrlInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") void runAudit();
          }}
          disabled={loading}
          className="flex-1 border-0 bg-transparent px-4 py-3 font-mono text-sm text-white shadow-none focus-visible:ring-0"
        />
        <button
          type="button"
          disabled={loading}
          onClick={() => void runAudit()}
          className="shrink-0 rounded-md bg-primary px-6 py-3 text-sm font-bold text-[#003640] transition-colors hover:bg-[#acedff] disabled:opacity-50"
        >
          {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : t("auditSubmit")}
        </button>
      </div>
    </div>
  ) : (
    <div className="flex flex-col gap-4 sm:flex-row sm:items-end">
      <div className="min-w-0 flex-1 space-y-2">
        <Label htmlFor="audit-url" className="text-muted-foreground">
          {t("auditUrlLabel")}
        </Label>
        <Input
          id="audit-url"
          type="url"
          inputMode="url"
          autoComplete="url"
          placeholder={t("auditUrlPlaceholder")}
          value={urlInput}
          onChange={(e) => setUrlInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") void runAudit();
          }}
          disabled={loading}
          className="bg-background/80"
        />
      </div>
      <Button
        type="button"
        size="lg"
        className="inline-flex shrink-0 gap-2"
        disabled={loading}
        onClick={() => void runAudit()}
      >
        {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
        {t("auditSubmit")}
      </Button>
    </div>
  );

  const resultSection =
    result != null ? (
      <div
        className={cn(
          "mt-8 space-y-6 border-t pt-8",
          landingInline ? "border-white/10" : "border-border",
        )}
      >
        <div className="flex flex-col gap-6 md:flex-row md:items-start">
          <div
            className={cn(
              "flex shrink-0 flex-col items-center justify-center rounded-2xl border px-8 py-6",
              landingInline
                ? "border-primary/30 bg-primary/5"
                : "border-primary/30 bg-primary/5",
            )}
          >
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              {t("auditScoreLabel")}
            </p>
            <p
              className="text-5xl font-bold tabular-nums text-primary md:text-6xl"
              style={{
                fontFamily: "var(--font-avop-display, var(--font-sans))",
              }}
            >
              {Math.round(result.overall_geo_score)}
            </p>
            <p className="mt-1 text-xs text-muted-foreground">
              {t("auditCitability", { score: Math.round(result.citability_score) })}
            </p>
          </div>

          <div className="min-w-0 flex-1 space-y-4">
            <div className="flex flex-wrap gap-2">
              {BOT_ORDER.map((bot) => (
                <span
                  key={bot}
                  className="inline-flex items-center gap-1.5 rounded-full border border-border bg-background/80 px-3 py-1 text-xs font-medium"
                >
                  {result.ai_crawler_access[bot] ? (
                    <Check className="h-3.5 w-3.5 text-emerald-500" />
                  ) : (
                    <X className="h-3.5 w-3.5 text-destructive" />
                  )}
                  {bot}
                </span>
              ))}
              <span className="inline-flex items-center gap-1.5 rounded-full border border-border bg-background/80 px-3 py-1 text-xs font-medium">
                {result.has_llms_txt ? (
                  <Check className="h-3.5 w-3.5 text-emerald-500" />
                ) : (
                  <X className="h-3.5 w-3.5 text-destructive" />
                )}
                llms.txt
              </span>
            </div>

            <div>
              <p className="mb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                {t("auditIssues")}
              </p>
              <ul className="space-y-2 text-sm">
                {result.top_issues.map((issue, i) => (
                  <li
                    key={`${i}-${issue.slice(0, 24)}`}
                    className={
                      i === 0
                        ? "text-foreground"
                        : "blur-sm select-none text-muted-foreground"
                    }
                  >
                    {issue}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>

        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <Button size="lg" asChild>
            <a href={registerHref}>{t("auditCta")}</a>
          </Button>
        </div>

        <div className="space-y-2 border-t border-border pt-6">
          <Label htmlFor="audit-email" className="text-muted-foreground">
            {t("auditEmailLabel")}
          </Label>
          <div className="flex flex-col gap-2 sm:flex-row">
            <Input
              id="audit-email"
              type="email"
              autoComplete="email"
              placeholder={t("auditEmailPlaceholder")}
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="max-w-md bg-background/80"
            />
            <Button
              type="button"
              variant="secondary"
              disabled={emailStatus === "saving" || !email.includes("@")}
              onClick={() => void saveEmail()}
            >
              {emailStatus === "saving" ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : null}
              {t("auditEmailSave")}
            </Button>
          </div>
          {emailStatus === "saved" ? (
            <p className="text-xs text-emerald-600 dark:text-emerald-400">
              {t("auditEmailSaved")}
            </p>
          ) : null}
          {emailStatus === "error" ? (
            <p className="text-xs text-destructive">{t("auditEmailError")}</p>
          ) : null}
        </div>
      </div>
    ) : null;

  if (landingInline) {
    return (
      <div className="w-full">
        {inputBlock}
        {error ? (
          <p className="mt-3 text-sm text-red-400" role="alert">
            {error}
          </p>
        ) : null}
        {resultSection}
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-border bg-card/50 p-6 shadow-sm md:p-8">
      {inputBlock}
      {error ? (
        <p className="mt-4 text-sm text-destructive" role="alert">
          {error}
        </p>
      ) : null}
      {resultSection}
    </div>
  );
}
