import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  ArrowRight,
  Check,
  FileSearch,
  Loader2,
  Radar,
  Sparkles,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ApiError, apiPatchPublic, apiPostPublic } from "@/lib/api-client";
import type { InfrastructureCheck, QuickAuditResult } from "@/types/quick-audit";
import { cn } from "@/lib/utils";

const BOT_ORDER = ["GPTBot", "ClaudeBot", "PerplexityBot"] as const;
const MAX_QUICK_SCORE = 40;
const MIN_SCAN_MS = 7000;
const SCAN_STEP_KEYS = [
  "auditScanStepResolve",
  "auditScanStepRobots",
  "auditScanStepLlms",
  "auditScanStepSitemap",
  "auditScanStepBots",
  "auditScanStepScore",
] as const;

function normalizeAuditUrl(raw: string): string {
  const u = raw.trim();
  if (!u) return "";
  if (!/^https?:\/\//i.test(u)) return `https://${u}`;
  return u;
}

function readinessKey(score: number): "ready" | "good" | "partial" | "blind" {
  if (score >= 20) return "ready";
  if (score >= 14) return "good";
  if (score >= 7) return "partial";
  return "blind";
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
  const [auditModalOpen, setAuditModalOpen] = useState(false);
  const [scanStep, setScanStep] = useState(0);

  const [email, setEmail] = useState("");
  const [emailStatus, setEmailStatus] = useState<"idle" | "saving" | "saved" | "error">(
    "idle",
  );

  useEffect(() => {
    if (!loading || !auditModalOpen) {
      setScanStep(0);
      return undefined;
    }

    const intervalMs = Math.round(MIN_SCAN_MS / SCAN_STEP_KEYS.length);
    const interval = window.setInterval(() => {
      setScanStep((current) => Math.min(current + 1, SCAN_STEP_KEYS.length - 1));
    }, intervalMs);

    return () => window.clearInterval(interval);
  }, [auditModalOpen, loading]);

  const runAudit = async () => {
    const url = normalizeAuditUrl(urlInput);
    if (url.length < 4) {
      setError(t("auditErrorShortUrl"));
      return;
    }

    setAuditModalOpen(true);
    setLoading(true);
    setError(null);
    setResult(null);
    setEmailStatus("idle");
    setScanStep(0);

    try {
      const auditPromise = apiPostPublic<QuickAuditResult>("/audit/quick", {
        url,
        email: null,
      });
      const scanDelay = new Promise<void>((resolve) =>
        window.setTimeout(resolve, MIN_SCAN_MS),
      );
      // Order is fixed: [0] must be the audit POST — not the scan delay promise.
      const settled = await Promise.allSettled([auditPromise, scanDelay]);
      const auditSettled = settled[0];

      if (auditSettled.status === "fulfilled") {
        const data = auditSettled.value;
        if (data && typeof data === "object" && "overall_geo_score" in data) {
          setResult(data);
          return;
        }
        setError(t("auditErrorGeneric"));
        return;
      }

      throw auditSettled.reason;
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

  const fallbackChecks: InfrastructureCheck[] = [
    {
      key: "llms_txt",
      label: "llms.txt",
      passed: result?.has_llms_txt ?? false,
      score: result?.has_llms_txt ? 3 : 0,
      details: "llms.txt check",
    },
    {
      key: "robots_txt",
      label: "robots.txt",
      passed: BOT_ORDER.every((bot) => result?.ai_crawler_access?.[bot]),
      score: BOT_ORDER.every((bot) => result?.ai_crawler_access?.[bot]) ? 4 : 0,
      details: "robots.txt check",
    },
    {
      key: "sitemap",
      label: "sitemap.xml",
      passed: result?.has_sitemap ?? false,
      score: result?.has_sitemap ? 6 : 0,
      details: "sitemap check",
    },
  ];

  const normalizedChecks = result?.infrastructure_checks?.length
    ? result.infrastructure_checks
    : fallbackChecks;

  const rawScore = result?.overall_geo_score;
  const numericScore =
    typeof rawScore === "number" && Number.isFinite(rawScore) ? rawScore : 0;
  const scorePct = result
    ? Math.min(100, Math.round((numericScore / MAX_QUICK_SCORE) * 100))
    : 0;
  const currentReadiness = readinessKey(numericScore);
  const healthy = result ? numericScore >= 18 : false;
  const crawlerAccess = result?.ai_crawler_access ?? {};
  const issueLines = result?.top_issues ?? [];
  const scanProgress = Math.min(
    96,
    Math.round(((scanStep + 1) / SCAN_STEP_KEYS.length) * 100),
  );

  const inputBlock = landingInline ? (
    <div className="relative max-w-xl group">
      <div className="absolute -inset-0.5 rounded-xl bg-gradient-to-r from-primary to-[#06b6d4] opacity-25 blur transition duration-1000 group-focus-within:opacity-50" />
      <div className="relative flex flex-col gap-2 rounded-xl border border-[#3d494c]/50 bg-[#1b1c1d] p-1.5 sm:flex-row">
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
          className="min-w-0 flex-1 border-0 bg-transparent px-4 py-3 font-mono text-sm text-white shadow-none focus-visible:ring-0"
        />
        <button
          type="button"
          disabled={loading}
          onClick={() => void runAudit()}
          className="inline-flex shrink-0 items-center justify-center rounded-lg bg-primary px-5 py-3 text-sm font-bold text-[#003640] transition-colors hover:bg-[#acedff] disabled:opacity-50"
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

  const auditModal = (
    <Dialog open={auditModalOpen} onOpenChange={setAuditModalOpen}>
      <DialogContent className="h-[min(820px,calc(100vh-1rem))] w-[min(1200px,calc(100vw-1rem))] max-w-none overflow-hidden border-white/10 bg-[#071112] p-0 text-white shadow-[0_30px_120px_rgba(0,0,0,0.65)] sm:max-w-[min(1200px,calc(100vw-1rem))]">
        <DialogTitle className="sr-only">{t("auditModalTitle")}</DialogTitle>
        <DialogDescription className="sr-only">
          {t("auditModalDescription")}
        </DialogDescription>

        <div className="relative h-full min-h-0 overflow-hidden">
          <div className="pointer-events-none absolute inset-0 opacity-70">
            <div className="absolute -left-24 top-8 h-56 w-56 rounded-full bg-cyan-400/20 blur-3xl" />
            <div className="absolute -bottom-24 right-8 h-64 w-64 rounded-full bg-emerald-300/15 blur-3xl" />
            <div className="quick-audit-scanline absolute inset-x-0 top-0 h-24 bg-gradient-to-b from-cyan-300/20 to-transparent" />
          </div>

          {loading ? (
            <div className="relative grid h-full min-h-0 grid-cols-1 gap-4 p-4 text-left md:grid-cols-[0.92fr_1.08fr] md:p-6">
              <div className="relative grid min-h-0 place-items-center rounded-[2rem] border border-white/10 bg-black/20 p-5 text-center">
                <div className="absolute inset-0 rounded-[2rem] bg-[radial-gradient(circle_at_50%_30%,rgba(34,211,238,0.18),transparent_56%)]" />
                <div className="relative max-w-sm">
                  <div className="relative mx-auto mb-5 flex h-44 w-44 items-center justify-center rounded-full border border-white/10 bg-black/30 sm:h-56 sm:w-56">
                    <div className="quick-audit-orbit absolute inset-4 rounded-full border border-dashed border-cyan-200/35" />
                    <div className="quick-audit-orbit-reverse absolute inset-9 rounded-full border border-dashed border-emerald-200/25" />
                    <div className="quick-audit-scanline absolute inset-x-8 top-4 h-16 rounded-full bg-gradient-to-b from-cyan-200/25 to-transparent" />
                    <Radar className="h-12 w-12 text-cyan-200 sm:h-14 sm:w-14" />
                  </div>
                  <p className="text-xs font-semibold uppercase tracking-[0.24em] text-cyan-200">
                    {t("auditModalLoadingKicker")}
                  </p>
                  <h3 className="mt-3 text-2xl font-black tracking-tight sm:text-3xl">
                    {t("auditModalLoadingTitle")}
                  </h3>
                  <p className="mt-3 text-sm leading-6 text-white/65">
                    {t("auditModalLoadingBody")}
                  </p>
                </div>
              </div>

              <div className="grid min-h-0 grid-rows-[auto_1fr_auto] gap-4 rounded-[2rem] border border-white/10 bg-white/[0.055] p-4 backdrop-blur md:p-5">
                <div>
                  <div className="mb-2 flex items-center justify-between gap-3 text-xs font-semibold uppercase tracking-[0.14em] text-white/55">
                    <span>{t("auditScanProgress")}</span>
                    <span className="font-mono text-cyan-200">{scanProgress}%</span>
                  </div>
                  <div className="h-3 overflow-hidden rounded-full bg-black/35">
                    <div
                      className="quick-audit-fill h-full rounded-full bg-gradient-to-r from-cyan-300 via-emerald-200 to-white"
                      style={{ width: `${scanProgress}%` }}
                    />
                  </div>
                </div>

                <div className="min-h-0 rounded-2xl border border-white/10 bg-black/30 p-3 font-mono text-xs text-white/70 sm:p-4">
                  <div className="mb-3 flex items-center gap-2 text-cyan-200">
                    <span className="h-2 w-2 animate-pulse rounded-full bg-cyan-200" />
                    <span>{normalizeAuditUrl(urlInput) || "https://example.com"}</span>
                  </div>
                  <div className="space-y-2">
                    {SCAN_STEP_KEYS.map((key, index) => {
                      const active = index === scanStep;
                      const done = index < scanStep;
                      return (
                        <div
                          key={key}
                          className={cn(
                            "flex min-w-0 items-center gap-3 rounded-xl border px-3 py-2 transition",
                            active
                              ? "border-cyan-300/35 bg-cyan-300/10 text-cyan-100"
                              : done
                                ? "border-emerald-300/25 bg-emerald-300/10 text-emerald-100"
                                : "border-white/10 bg-white/[0.03] text-white/45",
                          )}
                        >
                          <span className="inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full border border-current/25">
                            {done ? <Check className="h-3 w-3" /> : active ? "…" : index + 1}
                          </span>
                          <span className="truncate">{t(key)}</span>
                        </div>
                      );
                    })}
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-2 text-center text-[11px] font-semibold uppercase tracking-[0.12em] text-white/50">
                  <div className="rounded-2xl border border-white/10 bg-black/20 px-2 py-3">llms.txt</div>
                  <div className="rounded-2xl border border-white/10 bg-black/20 px-2 py-3">robots.txt</div>
                  <div className="rounded-2xl border border-white/10 bg-black/20 px-2 py-3">sitemap</div>
                </div>
              </div>
            </div>
          ) : error ? (
            <div className="relative grid min-h-[420px] place-items-center p-8 text-center">
              <div className="max-w-md rounded-3xl border border-red-300/20 bg-red-300/10 p-8">
                <X className="mx-auto h-10 w-10 text-red-200" />
                <h3 className="mt-4 text-2xl font-black">{t("auditModalErrorTitle")}</h3>
                <p className="mt-3 text-sm leading-6 text-white/70">{error}</p>
                <Button className="mt-6" onClick={() => setAuditModalOpen(false)}>
                  {t("auditModalClose")}
                </Button>
              </div>
            </div>
          ) : result ? (
            <div className="relative grid h-full min-h-0 min-w-0 grid-rows-[1fr_auto] gap-0 lg:grid-cols-[minmax(260px,0.85fr)_minmax(0,1.15fr)]">
              <div className="min-h-0 min-w-0 border-b border-white/10 p-4 sm:p-6 lg:border-b-0 lg:border-r">
                <div className="mb-3 inline-flex max-w-full items-center gap-2 rounded-full border border-cyan-300/25 bg-cyan-300/10 px-3 py-1.5 text-[11px] font-semibold uppercase leading-snug tracking-[0.14em] text-cyan-200 sm:px-4">
                  <Radar className="h-3.5 w-3.5 shrink-0" />
                  <span className="min-w-0 break-words">{t("auditModalKicker")}</span>
                </div>

                <div className="relative mx-auto flex aspect-square max-w-[188px] items-center justify-center rounded-full border border-white/10 bg-black/20 sm:max-w-[230px]">
                  <div className="quick-audit-orbit absolute inset-5 rounded-full border border-dashed border-cyan-200/25" />
                  <div className="quick-audit-orbit-reverse absolute inset-10 rounded-full border border-dashed border-emerald-200/20" />
                  <div className="absolute inset-0 rounded-full bg-[radial-gradient(circle,rgba(34,211,238,0.18),transparent_58%)]" />
                  <div className="relative text-center">
                    <p className="text-xs font-semibold uppercase tracking-[0.3em] text-cyan-100/70">
                      {t("auditScoreLabel")}
                    </p>
                    <p className="mt-1 text-5xl font-black tabular-nums text-white sm:text-6xl">
                      {Math.round(numericScore)}
                    </p>
                    <p className="text-sm font-semibold text-cyan-100">
                      {t("auditScoreScale", { max: MAX_QUICK_SCORE })}
                    </p>
                  </div>
                </div>

                <div className="mt-4">
                  <div className="mb-2 flex items-center justify-between gap-4 text-xs font-semibold uppercase tracking-[0.14em] text-white/60">
                    <span className="min-w-0 flex-1 break-words leading-snug">
                      {t(`auditReadiness.${currentReadiness}`)}
                    </span>
                    <span className="shrink-0">{scorePct}%</span>
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
                  <p className="mt-2 text-[11px] leading-4 text-white/50">
                    {t("auditCheckMax")}
                  </p>
                </div>
              </div>

              <div className="min-h-0 min-w-0 space-y-3 overflow-y-auto overflow-x-hidden p-4 sm:p-6">
                <div className="min-w-0">
                  <p className="text-sm font-semibold uppercase tracking-[0.16em] text-cyan-200">
                    {healthy ? t("auditModalReadyKicker") : t("auditModalWeakKicker")}
                  </p>
                  <h3 className="mt-1 max-w-2xl break-words text-xl font-black tracking-tight sm:text-2xl">
                    {healthy ? t("auditModalReadyTitle") : t("auditModalWeakTitle")}
                  </h3>
                  <p className="mt-2 max-w-2xl text-xs leading-5 text-white/65">
                    {t("auditModalBody")}
                  </p>
                </div>

                <div className="grid min-w-0 gap-2">
                  {normalizedChecks.map((check, index) => (
                    <div
                      key={check.key}
                      className="quick-audit-card-reveal min-w-0 rounded-2xl border border-white/10 bg-white/[0.055] p-3 backdrop-blur"
                      style={{ animationDelay: `${index * 120}ms` }}
                    >
                      <div className="flex min-w-0 items-start gap-3">
                        <span
                          className={cn(
                            "mt-0.5 inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-xl border",
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
                          <div className="flex min-w-0 items-start justify-between gap-3">
                            <p className="min-w-0 break-words font-semibold text-white">
                              {t(`auditCheck.${check.key}.label`, {
                                defaultValue: check.label,
                              })}
                            </p>
                            <p className="shrink-0 font-mono text-xs text-white/60">
                              {t("auditCheckScore", { score: Math.round(check.score) })}
                            </p>
                          </div>
                          <p className="mt-1 break-words text-xs leading-4 text-white/60">
                            {t(
                              `auditCheck.${check.key}.${check.passed ? "pass" : "fail"}`,
                              {
                                count: result.sitemap_url_count,
                                defaultValue: check.details,
                              },
                            )}
                          </p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>

                <div className="flex min-w-0 flex-wrap gap-2">
                  {BOT_ORDER.map((bot) => (
                    <span
                      key={bot}
                      className="inline-flex max-w-full items-center gap-1.5 rounded-full border border-white/10 bg-black/20 px-3 py-1 text-xs font-medium text-white/75"
                    >
                      {crawlerAccess[bot] ? (
                        <Check className="h-3.5 w-3.5 shrink-0 text-emerald-300" />
                      ) : (
                        <X className="h-3.5 w-3.5 shrink-0 text-red-300" />
                      )}
                      <span className="truncate">{bot}</span>
                    </span>
                  ))}
                  <span className="inline-flex max-w-full items-center gap-1.5 rounded-full border border-white/10 bg-black/20 px-3 py-1 text-xs font-medium text-white/75">
                    <FileSearch className="h-3.5 w-3.5 shrink-0 text-cyan-200" />
                    <span className="truncate">
                      {t("auditSitemapUrls", { count: result.sitemap_url_count })}
                    </span>
                  </span>
                </div>

                <div className="hidden rounded-2xl border border-white/10 bg-black/20 p-3 lg:block">
                  <p className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.14em] text-white/50">
                    <Sparkles className="h-3.5 w-3.5 shrink-0 text-cyan-200" />
                    <span>{t("auditIssues")}</span>
                  </p>
                  <ul className="space-y-1 text-xs text-white/75">
                    {issueLines.slice(0, 2).map((issue, i) => (
                      <li className="break-words" key={`${i}-${issue.slice(0, 24)}`}>
                        {issue}
                      </li>
                    ))}
                  </ul>
                </div>

                <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
                  <Button size="lg" asChild className="group w-full sm:w-auto">
                    <a href={registerHref}>
                      {t("auditCta")}
                      <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
                    </a>
                  </Button>
                </div>
              </div>

              <div className="min-w-0 border-t border-white/10 bg-black/15 p-3 sm:p-5 lg:col-span-2">
                <Label htmlFor="audit-email" className="text-white/65">
                  {t("auditEmailLabel")}
                </Label>
                <div className="mt-2 flex flex-col gap-2 sm:flex-row">
                  <Input
                    id="audit-email"
                    type="email"
                    autoComplete="email"
                    placeholder={t("auditEmailPlaceholder")}
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="min-w-0 max-w-md border-white/10 bg-white/10 text-white placeholder:text-white/35"
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
                  <p className="mt-2 text-xs text-emerald-300">{t("auditEmailSaved")}</p>
                ) : null}
                {emailStatus === "error" ? (
                  <p className="mt-2 text-xs text-red-300">{t("auditEmailError")}</p>
                ) : null}
              </div>
            </div>
          ) : (
            <div className="relative grid min-h-[320px] place-items-center p-8 text-center">
              <div className="max-w-md space-y-4">
                <p className="text-sm text-white/75">{t("auditErrorGeneric")}</p>
                <Button type="button" onClick={() => setAuditModalOpen(false)}>
                  {t("auditModalClose")}
                </Button>
              </div>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );

  if (landingInline) {
    return (
      <div className="w-full">
        {inputBlock}
        {error && !auditModalOpen ? (
          <p className="mt-3 text-sm text-red-400" role="alert">
            {error}
          </p>
        ) : null}
        {auditModal}
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-border bg-card/50 p-6 shadow-sm md:p-8">
      {inputBlock}
      {error && !auditModalOpen ? (
        <p className="mt-4 text-sm text-destructive" role="alert">
          {error}
        </p>
      ) : null}
      {auditModal}
    </div>
  );
}
