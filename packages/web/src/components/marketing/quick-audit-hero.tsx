import { useState } from "react";
import { useTranslation } from "react-i18next";
import { ArrowRight, Check, FileSearch, Loader2, Radar, Sparkles, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ApiError, apiPatchPublic, apiPostPublic } from "@/lib/api-client";
import type { QuickAuditResult } from "@/types/quick-audit";
import { cn } from "@/lib/utils";

const BOT_ORDER = ["GPTBot", "ClaudeBot", "PerplexityBot"] as const;
const MAX_QUICK_SCORE = 40;

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

  const normalizedChecks = result?.infrastructure_checks?.length
    ? result.infrastructure_checks
    : [
        {
          key: "llms_txt",
          label: "llms.txt AI brief",
          passed: result?.has_llms_txt ?? false,
          score: result?.has_llms_txt ? 14 : 0,
          details: result?.has_llms_txt
            ? "llms.txt detected."
            : "No llms.txt detected at /llms.txt.",
        },
        {
          key: "robots_txt",
          label: "AI crawler access",
          passed: BOT_ORDER.every((bot) => result?.ai_crawler_access?.[bot]),
          score: BOT_ORDER.every((bot) => result?.ai_crawler_access?.[bot]) ? 9 : 0,
          details: "robots.txt should allow major AI crawlers.",
        },
        {
          key: "sitemap",
          label: "Sitemap discovery",
          passed: result?.has_sitemap ?? false,
          score: result?.has_sitemap ? 12 : 0,
          details: result?.has_sitemap
            ? "XML sitemap detected."
            : "No sitemap found at standard locations.",
        },
      ];

  const scorePct = result
    ? Math.min(100, Math.round((result.overall_geo_score / MAX_QUICK_SCORE) * 100))
    : 0;
  const healthy = result ? result.overall_geo_score >= 30 : false;

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
          "mt-8 overflow-hidden rounded-[2rem] border",
          landingInline
            ? "border-white/10 bg-[#071112]/85 text-white shadow-[0_24px_90px_rgba(0,0,0,0.45)]"
            : "border-border bg-card text-foreground shadow-2xl",
        )}
      >
        <div className="relative grid gap-0 lg:grid-cols-[0.95fr_1.05fr]">
          <div className="pointer-events-none absolute inset-0 opacity-70">
            <div className="absolute -left-24 top-8 h-56 w-56 rounded-full bg-cyan-400/20 blur-3xl" />
            <div className="absolute -bottom-24 right-8 h-64 w-64 rounded-full bg-emerald-300/15 blur-3xl" />
            <div className="quick-audit-scanline absolute inset-x-0 top-0 h-24 bg-gradient-to-b from-cyan-300/20 to-transparent" />
          </div>

          <div className="relative border-b border-white/10 p-6 md:p-8 lg:border-b-0 lg:border-r">
            <div className="mb-5 inline-flex items-center gap-2 rounded-full border border-cyan-300/25 bg-cyan-300/10 px-3 py-1 text-xs font-semibold uppercase tracking-[0.24em] text-cyan-200">
              <Radar className="h-3.5 w-3.5" />
              AI crawler scan
            </div>

            <div className="relative mx-auto flex aspect-square max-w-[260px] items-center justify-center rounded-full border border-white/10 bg-black/20">
              <div className="quick-audit-orbit absolute inset-5 rounded-full border border-dashed border-cyan-200/25" />
              <div className="quick-audit-orbit-reverse absolute inset-10 rounded-full border border-dashed border-emerald-200/20" />
              <div className="absolute inset-0 rounded-full bg-[radial-gradient(circle,rgba(34,211,238,0.18),transparent_58%)]" />
              <div className="relative text-center">
                <p className="text-xs font-semibold uppercase tracking-[0.3em] text-cyan-100/70">
                  readiness
                </p>
                <p className="mt-2 text-6xl font-black tabular-nums text-white">
                  {Math.round(result.overall_geo_score)}
                </p>
                <p className="text-sm font-semibold text-cyan-100">
                  / {MAX_QUICK_SCORE}
                </p>
              </div>
            </div>

            <div className="mt-6">
              <div className="mb-2 flex items-center justify-between text-xs font-semibold uppercase tracking-[0.18em] text-white/60">
                <span>{result.readiness_label}</span>
                <span>{scorePct}% of quick-check max</span>
              </div>
              <div className="h-3 overflow-hidden rounded-full bg-white/10">
                <div
                  className={cn(
                    "quick-audit-fill h-full rounded-full",
                    healthy
                      ? "bg-gradient-to-r from-emerald-300 via-cyan-300 to-white"
                      : "bg-gradient-to-r from-red-400 via-amber-300 to-cyan-300",
                  )}
                  style={{ width: `${scorePct}%` }}
                />
              </div>
            </div>
          </div>

          <div className="relative space-y-5 p-6 md:p-8">
            <div>
              <p className="text-sm font-semibold uppercase tracking-[0.2em] text-cyan-200">
                {healthy ? "Your AI files are discoverable" : "AI crawlers need clearer signals"}
              </p>
              <h3 className="mt-2 text-2xl font-black tracking-tight md:text-3xl">
                {healthy
                  ? "The basics are in place. Now test the full GEO picture."
                  : "Search bots can miss your site before content quality even matters."}
              </h3>
              <p className="mt-3 text-sm leading-6 text-white/65">
                We checked the three files AI crawlers look for first: `llms.txt`,
                `robots.txt`, and `sitemap.xml`. Full audit checks content, schema,
                citations, competitors, and platform readiness.
              </p>
            </div>

            <div className="grid gap-3">
              {normalizedChecks.map((check, index) => (
                <div
                  key={check.key}
                  className="quick-audit-card-reveal rounded-2xl border border-white/10 bg-white/[0.055] p-4 backdrop-blur"
                  style={{ animationDelay: `${index * 120}ms` }}
                >
                  <div className="flex items-start gap-3">
                    <span
                      className={cn(
                        "mt-0.5 inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border",
                        check.passed
                          ? "border-emerald-300/30 bg-emerald-300/15 text-emerald-200"
                          : "border-red-300/30 bg-red-300/10 text-red-200",
                      )}
                    >
                      {check.passed ? (
                        <Check className="h-4 w-4" />
                      ) : (
                        <X className="h-4 w-4" />
                      )}
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center justify-between gap-3">
                        <p className="font-semibold text-white">{check.label}</p>
                        <p className="font-mono text-xs text-white/60">
                          +{Math.round(check.score)}
                        </p>
                      </div>
                      <p className="mt-1 text-sm leading-5 text-white/60">
                        {check.details}
                      </p>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            <div className="flex flex-wrap gap-2">
              {BOT_ORDER.map((bot) => (
                <span
                  key={bot}
                  className="inline-flex items-center gap-1.5 rounded-full border border-white/10 bg-black/20 px-3 py-1 text-xs font-medium text-white/75"
                >
                  {result.ai_crawler_access[bot] ? (
                    <Check className="h-3.5 w-3.5 text-emerald-300" />
                  ) : (
                    <X className="h-3.5 w-3.5 text-red-300" />
                  )}
                  {bot}
                </span>
              ))}
              <span className="inline-flex items-center gap-1.5 rounded-full border border-white/10 bg-black/20 px-3 py-1 text-xs font-medium text-white/75">
                <FileSearch className="h-3.5 w-3.5 text-cyan-200" />
                {result.sitemap_url_count} sitemap URLs
              </span>
            </div>

            <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
              <p className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.18em] text-white/50">
                <Sparkles className="h-3.5 w-3.5 text-cyan-200" />
                {t("auditIssues")}
              </p>
              <ul className="space-y-2 text-sm text-white/75">
                {result.top_issues.slice(0, 3).map((issue, i) => (
                  <li key={`${i}-${issue.slice(0, 24)}`}>{issue}</li>
                ))}
              </ul>
            </div>

            <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
              <Button size="lg" asChild className="group">
                <a href={registerHref}>
                  {t("auditCta")}
                  <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
                </a>
              </Button>
            </div>
          </div>
        </div>

        <div className="space-y-2 border-t border-white/10 bg-black/15 p-6 md:p-8">
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
