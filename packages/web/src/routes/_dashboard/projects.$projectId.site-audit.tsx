import { useEffect, useRef, useState } from "react";
import { createFileRoute, Link, useParams } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import {
  AlertCircle,
  CheckCircle2,
  Clock,
  Download,
  Loader2,
  Play,
  RefreshCw,
  Shield,
  FileText,
  Globe,
  Code2,
  Layers,
  BarChart3,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  useLatestSiteAudit,
  useStartSiteAudit,
  type AiInsights,
  type AuditIssue,
  type FullSiteAuditResult,
  type SiteAuditStatus,
} from "@/hooks/use-site-audit";
import { useLatestRun } from "@/hooks/use-runs";
import { getAccessToken } from "@/lib/auth";

export const Route = createFileRoute(
  "/_dashboard/projects/$projectId/site-audit",
)({
  component: SiteAuditPage,
});

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function scoreColour(score: number): string {
  if (score >= 70) return "text-green-600 dark:text-green-400";
  if (score >= 45) return "text-amber-600 dark:text-amber-400";
  return "text-red-600 dark:text-red-400";
}


function severityBadge(severity: string) {
  switch (severity) {
    case "critical":
      return <Badge variant="destructive" className="text-[10px]">Critical</Badge>;
    case "warning":
      return (
        <Badge className="bg-amber-100 text-amber-800 border-amber-200 dark:bg-amber-950 dark:text-amber-300 text-[10px]">
          Warning
        </Badge>
      );
    default:
      return (
        <Badge variant="outline" className="text-[10px]">
          Info
        </Badge>
      );
  }
}

function StatusBadge({ status }: { status: SiteAuditStatus }) {
  switch (status) {
    case "completed":
      return (
        <Badge className="bg-green-100 text-green-800 dark:bg-green-950 dark:text-green-300 border-green-200">
          <CheckCircle2 className="w-3 h-3 mr-1" /> Completed
        </Badge>
      );
    case "running":
      return (
        <Badge className="bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-300 border-blue-200">
          <Loader2 className="w-3 h-3 mr-1 animate-spin" /> Running
        </Badge>
      );
    case "failed":
      return (
        <Badge variant="destructive">
          <AlertCircle className="w-3 h-3 mr-1" /> Failed
        </Badge>
      );
    default:
      return (
        <Badge variant="outline">
          <Clock className="w-3 h-3 mr-1" /> Pending
        </Badge>
      );
  }
}

// ---------------------------------------------------------------------------
// Score gauge (simple circle)
// ---------------------------------------------------------------------------

function ScoreGauge({
  score,
  label,
  size = "lg",
}: {
  score: number;
  label: string;
  size?: "lg" | "sm";
}) {
  const r = size === "lg" ? 52 : 28;
  const cx = size === "lg" ? 60 : 34;
  const cy = size === "lg" ? 60 : 34;
  const circumference = 2 * Math.PI * r;
  const offset = circumference - (score / 100) * circumference;
  const strokeColour =
    score >= 70 ? "#16a34a" : score >= 45 ? "#f59e0b" : "#dc2626";
  const glowColour =
    score >= 70 ? "#bbf7d0" : score >= 45 ? "#fde68a" : "#fecaca";
  const viewBox = size === "lg" ? "0 0 120 120" : "0 0 68 68";
  const textSize = size === "lg" ? "text-3xl" : "text-sm";
  const svgSize = size === "lg" ? 120 : 68;

  return (
    <div className="flex flex-col items-center gap-2">
      <div className="relative">
        <svg
          width={svgSize}
          height={svgSize}
          viewBox={viewBox}
          className="-rotate-90"
        >
          {/* Glow effect */}
          {size === "lg" && (
            <circle
              cx={cx}
              cy={cy}
              r={r + 6}
              fill="none"
              stroke={glowColour}
              strokeWidth={4}
              opacity={0.4}
            />
          )}
          {/* Track */}
          <circle
            cx={cx}
            cy={cy}
            r={r}
            fill="none"
            stroke="currentColor"
            className="text-muted"
            strokeWidth={size === "lg" ? 10 : 6}
          />
          {/* Progress */}
          <circle
            cx={cx}
            cy={cy}
            r={r}
            fill="none"
            stroke={strokeColour}
            strokeWidth={size === "lg" ? 10 : 6}
            strokeDasharray={circumference}
            strokeDashoffset={offset}
            strokeLinecap="round"
          />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className={`${textSize} font-bold ${scoreColour(score)} leading-none`}>
            {score.toFixed(0)}
          </span>
          {size === "lg" && (
            <span className="text-xs text-muted-foreground font-medium">/100</span>
          )}
        </div>
      </div>
      <p className="text-xs text-muted-foreground text-center leading-tight font-medium">{label}</p>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Pillar card
// ---------------------------------------------------------------------------

function PillarCard({
  icon,
  title,
  score,
  description,
}: {
  icon: React.ReactNode;
  title: string;
  score: number;
  description: string;
}) {
  const label =
    score >= 70 ? "Good" : score >= 45 ? "Fair" : "Poor";
  const labelCls =
    score >= 70
      ? "text-green-700 bg-green-100 dark:text-green-300 dark:bg-green-950"
      : score >= 45
      ? "text-amber-700 bg-amber-100 dark:text-amber-300 dark:bg-amber-950"
      : "text-red-700 bg-red-100 dark:text-red-300 dark:bg-red-950";

  return (
    <Card className="border hover:shadow-md transition-shadow">
      <CardContent className="pt-4 pb-4">
        <div className="flex items-center gap-2 mb-3">
          <div className="p-1.5 rounded-md bg-muted/60">{icon}</div>
          <div className="flex-1 min-w-0">
            <p className="text-xs font-semibold text-foreground truncate">{title}</p>
            <p className="text-[10px] text-muted-foreground">{description}</p>
          </div>
          <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-full ${labelCls}`}>
            {label}
          </span>
        </div>
        <div className="flex items-end justify-between mb-1.5">
          <span className={`text-2xl font-bold tabular-nums ${scoreColour(score)}`}>
            {score.toFixed(0)}
          </span>
          <span className="text-xs text-muted-foreground">/100</span>
        </div>
        <Progress value={score} className="h-1.5" />
      </CardContent>
    </Card>
  );
}

// ---------------------------------------------------------------------------
// Issues list
// ---------------------------------------------------------------------------

function IssuesList({ issues }: { issues: AuditIssue[] }) {
  if (!issues.length)
    return (
      <div className="flex items-center gap-2 text-sm text-green-700 dark:text-green-400 py-2">
        <CheckCircle2 className="w-4 h-4" />
        No issues detected.
      </div>
    );

  const borderCls = (severity: string) =>
    severity === "critical"
      ? "border-l-red-500"
      : severity === "warning"
      ? "border-l-amber-400"
      : "border-l-teal-400";

  return (
    <div className="space-y-2">
      {issues.map((issue, i) => (
        <div
          key={i}
          className={`flex items-start gap-3 rounded-lg border border-l-4 bg-background/60 p-3 ${borderCls(issue.severity)}`}
        >
          <div className="mt-0.5 shrink-0">{severityBadge(issue.severity)}</div>
          <div className="flex-1 min-w-0">
            <p className="text-sm text-foreground">{issue.message}</p>
            {issue.recommendation && (
              <p className="text-xs text-muted-foreground mt-0.5">
                {issue.recommendation}
              </p>
            )}
          </div>
          <Badge variant="outline" className="text-[10px] shrink-0 capitalize">
            {issue.category}
          </Badge>
        </div>
      ))}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Platform Readiness table
// ---------------------------------------------------------------------------

function PlatformTable({
  platforms,
}: {
  platforms: FullSiteAuditResult["platforms"];
}) {
  const rows = [
    { name: "Google AI Overviews", score: platforms.google_aio },
    { name: "ChatGPT", score: platforms.chatgpt },
    { name: "Perplexity", score: platforms.perplexity },
    { name: "Gemini", score: platforms.gemini },
    { name: "Bing Copilot", score: platforms.copilot },
  ];

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Platform</TableHead>
          <TableHead>Score</TableHead>
          <TableHead>Readiness</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {rows.map((row) => (
          <TableRow key={row.name}>
            <TableCell className="font-medium">{row.name}</TableCell>
            <TableCell>
              <span className={`font-semibold ${scoreColour(row.score)}`}>
                {row.score.toFixed(0)}/100
              </span>
            </TableCell>
            <TableCell>
              <Progress value={row.score} className="h-2 w-28" />
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}

// ---------------------------------------------------------------------------
// AI Crawler access
// ---------------------------------------------------------------------------

function CrawlerTable({
  access,
}: {
  access: Record<string, string>;
}) {
  const entries = Object.entries(access);
  if (!entries.length)
    return <p className="text-sm text-muted-foreground">No robots.txt data available.</p>;

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Crawler</TableHead>
          <TableHead>Status</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {entries.map(([bot, status]) => {
          const isBlocked = status.includes("BLOCKED");
          const isExplicit = status === "ALLOWED_EXPLICIT";
          return (
            <TableRow key={bot}>
              <TableCell className="font-mono text-xs">{bot}</TableCell>
              <TableCell>
                <Badge
                  variant={isBlocked ? "destructive" : "outline"}
                  className={
                    isBlocked
                      ? ""
                      : isExplicit
                      ? "bg-teal-50 text-teal-800 border-teal-200 dark:bg-teal-950 dark:text-teal-300"
                      : "bg-green-50 text-green-800 border-green-200 dark:bg-green-950 dark:text-green-300"
                  }
                >
                  {isBlocked ? "Blocked" : isExplicit ? "Allowed (explicit)" : "Allowed"}
                </Badge>
              </TableCell>
            </TableRow>
          );
        })}
      </TableBody>
    </Table>
  );
}

// ---------------------------------------------------------------------------
// Audit results panel
// ---------------------------------------------------------------------------

function AuditResults({ result }: { result: FullSiteAuditResult }) {
  const { t } = useTranslation("projects");
  return (
    <div className="space-y-8">
      {/* Overall Score + Pillar overview */}
      <div className="rounded-xl border bg-gradient-to-br from-background to-muted/30 p-6">
        <div className="grid grid-cols-1 lg:grid-cols-[auto_1fr] gap-8">
          {/* Left: big gauge */}
          <div className="flex flex-col items-center justify-center gap-4 lg:pr-8 lg:border-r border-border">
            <ScoreGauge
              score={result.overall_geo_score}
              label={t("siteAudit.overallScoreLabel")}
              size="lg"
            />
            <div className="text-center space-y-1">
              <p className="text-xs font-medium text-muted-foreground max-w-[160px] leading-snug">
                Composite across citability, content, technical, schema, platforms &amp; brand
              </p>
            </div>
          </div>

          {/* Right: pillar grid */}
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            <PillarCard
              icon={<BarChart3 className="w-4 h-4 text-teal-600" />}
              title="AI Citability"
              score={result.citability_score}
              description="25% weight"
            />
            <PillarCard
              icon={<FileText className="w-4 h-4 text-blue-600" />}
              title="Content E-E-A-T"
              score={result.content.score}
              description="20% weight"
            />
            <PillarCard
              icon={<Shield className="w-4 h-4 text-violet-600" />}
              title="Technical SEO"
              score={result.technical.score}
              description="15% weight"
            />
            <PillarCard
              icon={<Code2 className="w-4 h-4 text-orange-600" />}
              title="Structured Data"
              score={result.schema.score}
              description="10% weight"
            />
            <PillarCard
              icon={<Globe className="w-4 h-4 text-pink-600" />}
              title="Platforms"
              score={result.platforms.average}
              description="10% weight"
            />
            <PillarCard
              icon={<Layers className="w-4 h-4 text-slate-600" />}
              title="llms.txt"
              score={result.llmstxt.score}
              description="llms.txt quality"
            />
          </div>
        </div>
      </div>

      {/* Platform readiness */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Platform Readiness</CardTitle>
          <CardDescription>How well each AI platform can access and cite your content.</CardDescription>
        </CardHeader>
        <CardContent>
          <PlatformTable platforms={result.platforms} />
        </CardContent>
      </Card>

      {/* AI Crawler access */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">AI Crawler Access (robots.txt)</CardTitle>
        </CardHeader>
        <CardContent>
          <CrawlerTable access={result.technical.ai_crawler_access} />
        </CardContent>
      </Card>

      {/* Top issues */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Top Issues</CardTitle>
          <CardDescription>Sorted by severity — fix critical issues first.</CardDescription>
        </CardHeader>
        <CardContent>
          <IssuesList issues={result.top_issues} />
        </CardContent>
      </Card>

      {/* Top recommendations */}
      {result.top_recommendations.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Top Recommendations</CardTitle>
            <CardDescription>{t("siteAudit.recommendationsHint")}</CardDescription>
          </CardHeader>
          <CardContent>
            <ol className="space-y-2">
              {result.top_recommendations.map((rec, i) => (
                <li key={i} className="flex items-start gap-3 rounded-lg border bg-muted/20 px-4 py-3">
                  <span className="flex-shrink-0 w-6 h-6 rounded-full bg-teal-100 dark:bg-teal-950 text-teal-700 dark:text-teal-300 text-xs font-bold flex items-center justify-center mt-0.5">
                    {i + 1}
                  </span>
                  <p className="text-sm text-foreground leading-relaxed">{rec}</p>
                </li>
              ))}
            </ol>
          </CardContent>
        </Card>
      )}

      {/* AI Insights (when anthropic key is configured) */}
      {result.ai_insights && (
        <AiInsightsPanel insights={result.ai_insights} />
      )}

      {/* Technical detail */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Technical Checks</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-1 text-sm">
              {[
                ["HTTPS", result.technical.is_https],
                ["Sitemap found", result.technical.has_sitemap],
                ["robots.txt found", result.technical.has_robots_txt],
                ["llms.txt found", result.technical.has_llmstxt],
                ["Canonical tag", result.technical.has_canonical],
                ["OG tags", result.technical.has_og_tags],
                ["Mobile viewport", result.technical.has_mobile_viewport],
              ].map(([label, value]) => (
                <div key={label as string} className="flex justify-between py-1 border-b last:border-0">
                  <span className="text-muted-foreground">{label as string}</span>
                  <span className={value ? "text-green-600 dark:text-green-400 font-medium" : "text-red-600 dark:text-red-400 font-medium"}>
                    {value ? "Yes" : "No"}
                  </span>
                </div>
              ))}
              {result.technical.ttfb_ms != null && (
                <div className="flex justify-between py-1 border-b">
                  <span className="text-muted-foreground">TTFB</span>
                  <span className="font-medium">{result.technical.ttfb_ms.toFixed(0)} ms</span>
                </div>
              )}
              {result.technical.sitemap_url_count > 0 && (
                <div className="flex justify-between py-1">
                  <span className="text-muted-foreground">Sitemap URLs</span>
                  <span className="font-medium">{result.technical.sitemap_url_count}</span>
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Structured Data</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-1 text-sm">
              {[
                ["Organization schema", result.schema.has_organization],
                ["WebSite schema", result.schema.has_website],
                ["SearchAction", result.schema.has_search_action],
                ["BreadcrumbList", result.schema.has_breadcrumbs],
                ["Speakable", result.schema.has_speakable],
                ["Server-rendered", result.schema.is_server_rendered],
              ].map(([label, value]) => (
                <div key={label as string} className="flex justify-between py-1 border-b last:border-0">
                  <span className="text-muted-foreground">{label as string}</span>
                  <span className={value ? "text-green-600 dark:text-green-400 font-medium" : "text-muted-foreground"}>
                    {value ? "Yes" : "No"}
                  </span>
                </div>
              ))}
              {result.schema.schema_types.length > 0 && (
                <div className="flex justify-between py-1">
                  <span className="text-muted-foreground">Types</span>
                  <span className="font-medium text-right text-xs max-w-[200px]">
                    {result.schema.schema_types.join(", ")}
                  </span>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Content quality */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Content Quality (E-E-A-T)</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
            {[
              { label: "Experience", score: result.content.score_experience, max: 25 },
              { label: "Expertise", score: result.content.score_expertise, max: 25 },
              { label: "Authority", score: result.content.score_authoritativeness, max: 25 },
              { label: "Trust", score: result.content.score_trustworthiness, max: 25 },
            ].map(({ label, score, max }) => {
              const pct = (score / max) * 100;
              return (
                <div key={label} className="flex flex-col items-center gap-2 p-4 rounded-xl border bg-background/60 hover:shadow-sm transition-shadow">
                  <ScoreGauge score={pct} label={label} size="sm" />
                  <div className="text-center">
                    <span className={`text-lg font-bold tabular-nums ${scoreColour(pct)}`}>
                      {score.toFixed(0)}
                    </span>
                    <span className="text-xs text-muted-foreground">/{max}</span>
                  </div>
                </div>
              );
            })}
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 text-sm">
            {[
              ["Word Count", result.content.word_count],
              ["Paragraphs", result.content.paragraph_count],
              ["Heading Depth", result.content.heading_depth],
              ["Stat Density", `${result.content.statistical_density.toFixed(1)}/1k`],
              ["External Links", result.content.external_link_count],
              ["Author Present", result.content.has_author ? "Yes" : "No"],
            ].map(([label, value]) => (
              <div key={label as string} className="flex justify-between px-3 py-1.5 rounded border bg-muted/30">
                <span className="text-muted-foreground text-xs">{label as string}</span>
                <span className="font-medium text-xs">{value as string | number}</span>
              </div>
            ))}
          </div>
          {result.content.ai_scored && (
            <p className="text-xs text-muted-foreground mt-2">
              E-E-A-T scored by AI (gpt-4o-mini).
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

// ---------------------------------------------------------------------------
// AI Insights panel
// ---------------------------------------------------------------------------

function AiInsightsPanel({ insights }: { insights: AiInsights }) {
  const [openWeek, setOpenWeek] = useState<string | null>("week1");
  const weekLabels: Record<string, string> = {
    week1: "Week 1",
    week2: "Week 2",
    week3: "Week 3",
    week4: "Week 4",
  };

  return (
    <div className="space-y-6">
      {/* Executive Summary */}
      {insights.executive_summary && (
        <Card className="border-teal-200 dark:border-teal-800 bg-teal-50/40 dark:bg-teal-950/20">
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <span className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-teal-100 dark:bg-teal-900 text-teal-700 dark:text-teal-300 text-xs font-bold">AI</span>
              AI Executive Summary
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm leading-relaxed text-foreground whitespace-pre-line">
              {insights.executive_summary}
            </p>
            {insights.root_cause && (
              <div className="mt-4 rounded-lg border border-amber-200 dark:border-amber-800 bg-amber-50 dark:bg-amber-950/30 px-4 py-3">
                <p className="text-xs font-semibold text-amber-700 dark:text-amber-400 uppercase tracking-wide mb-1">Root Cause</p>
                <p className="text-sm text-foreground">{insights.root_cause}</p>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Critical Issues */}
      {insights.critical_issues.length > 0 && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Critical Issues</CardTitle>
            <CardDescription>AI-identified blockers sorted by impact.</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {insights.critical_issues.map((issue) => (
                <div
                  key={issue.id}
                  className="rounded-lg border border-border bg-background p-4 space-y-2"
                >
                  <div className="flex items-center gap-2">
                    <Badge variant="outline" className="font-mono text-[10px] shrink-0">
                      {issue.id}
                    </Badge>
                    <span className="font-medium text-sm text-foreground">
                      {issue.title}
                    </span>
                  </div>
                  <p className="text-sm text-muted-foreground leading-relaxed">
                    {issue.detail}
                  </p>
                  <div className="rounded-md bg-teal-50 dark:bg-teal-950/30 border border-teal-100 dark:border-teal-900 px-3 py-2">
                    <p className="text-xs font-semibold text-teal-700 dark:text-teal-400 uppercase tracking-wide mb-0.5">Fix</p>
                    <p className="text-sm text-foreground">{issue.fix}</p>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* 30-Day Action Plan */}
      {Object.keys(insights.action_plan).length > 0 && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">30-Day Action Plan</CardTitle>
            <CardDescription>Prioritised implementation roadmap.</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {(["week1", "week2", "week3", "week4"] as const).map((week) => {
                const items = insights.action_plan[week];
                if (!items?.length) return null;
                const isOpen = openWeek === week;
                return (
                  <div key={week} className="rounded-lg border border-border overflow-hidden">
                    <button
                      type="button"
                      className="w-full flex items-center justify-between px-4 py-3 text-sm font-medium text-foreground bg-muted/30 hover:bg-muted/50 transition-colors"
                      onClick={() => setOpenWeek(isOpen ? null : week)}
                    >
                      <span>{weekLabels[week]}</span>
                      <span className="text-muted-foreground">{isOpen ? "▲" : "▼"}</span>
                    </button>
                    {isOpen && (
                      <ul className="px-4 py-3 space-y-2">
                        {items.map((item, i) => (
                          <li key={i} className="flex items-start gap-3 text-sm text-foreground">
                            <span className="flex-shrink-0 w-5 h-5 rounded-full bg-teal-100 dark:bg-teal-950 text-teal-700 dark:text-teal-300 text-xs font-bold flex items-center justify-center mt-0.5">
                              {i + 1}
                            </span>
                            {item}
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Empty / loading states
// ---------------------------------------------------------------------------

function AuditSkeleton() {
  return (
    <div className="space-y-4">
      <Skeleton className="h-40" />
      <div className="grid grid-cols-3 gap-4">
        <Skeleton className="h-24" />
        <Skeleton className="h-24" />
        <Skeleton className="h-24" />
      </div>
      <Skeleton className="h-48" />
    </div>
  );
}

function formatRunningDuration(totalSeconds: number): string {
  const h = Math.floor(totalSeconds / 3600);
  const m = Math.floor((totalSeconds % 3600) / 60);
  const s = totalSeconds % 60;
  if (h > 0) {
    return `${h}:${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
  }
  return `${m}:${s.toString().padStart(2, "0")}`;
}

const SITE_AUDIT_PHASE_KEYS = [
  "siteAudit.phase0",
  "siteAudit.phase1",
  "siteAudit.phase2",
  "siteAudit.phase3",
  "siteAudit.phase4",
] as const;

function elapsedSecondsFromAnchor(iso: string): number {
  const ms = Date.parse(iso);
  if (Number.isNaN(ms)) return 0;
  return Math.max(0, Math.floor((Date.now() - ms) / 1000));
}

/** Illustrative stages — elapsed time is derived from `started_at` (or `created_at`) from the API. */
function RunningAuditStatus({ startedAtIso }: { startedAtIso: string }) {
  const { t } = useTranslation("projects");
  const [elapsed, setElapsed] = useState(() =>
    elapsedSecondsFromAnchor(startedAtIso),
  );

  useEffect(() => {
    const tick = () => {
      setElapsed(elapsedSecondsFromAnchor(startedAtIso));
    };
    tick();
    const id = window.setInterval(tick, 1000);
    return () => window.clearInterval(id);
  }, [startedAtIso]);

  const phaseSeconds = 180;
  const phaseIndex = Math.min(
    SITE_AUDIT_PHASE_KEYS.length - 1,
    Math.floor(elapsed / phaseSeconds),
  );
  const activePhaseKey =
    SITE_AUDIT_PHASE_KEYS[phaseIndex] ?? SITE_AUDIT_PHASE_KEYS[0];

  return (
    <div className="w-full space-y-3 border-t border-border pt-3">
      <div className="flex flex-col gap-1 sm:flex-row sm:items-start sm:justify-between sm:gap-4">
        <p className="text-sm font-medium text-foreground">
          {t(activePhaseKey)}
        </p>
        <p className="shrink-0 text-xs text-muted-foreground tabular-nums sm:pt-0.5">
          {t("siteAudit.runningFor", {
            time: formatRunningDuration(elapsed),
          })}
        </p>
      </div>
      <ul className="space-y-1.5">
        {SITE_AUDIT_PHASE_KEYS.map((key, i) => (
          <li
            key={key}
            className={`flex items-center gap-2 text-xs ${
              i === phaseIndex
                ? "font-medium text-foreground"
                : "text-muted-foreground/80"
            }`}
          >
            {i === phaseIndex ? (
              <Loader2
                className="h-3.5 w-3.5 shrink-0 animate-spin text-primary"
                aria-hidden
              />
            ) : (
              <span
                className="inline-block h-2 w-2 shrink-0 rounded-full bg-muted-foreground/25"
                aria-hidden
              />
            )}
            {t(key)}
          </li>
        ))}
      </ul>
      <p className="text-xs leading-snug text-muted-foreground">
        {t("siteAudit.runningHint")}
      </p>
      <p className="text-[10px] text-muted-foreground/90">
        {t("siteAudit.phasesNote")}
      </p>
    </div>
  );
}

function NoAuditState({
  onStart,
  isPending,
}: {
  onStart: () => void;
  isPending: boolean;
}) {
  const { t } = useTranslation("projects");
  return (
    <Card className="border-dashed">
      <CardContent className="flex flex-col items-center justify-center py-16 gap-4">
        <div className="p-4 rounded-full bg-teal-50 dark:bg-teal-950">
          <Globe className="w-8 h-8 text-teal-600 dark:text-teal-400" />
        </div>
        <div className="text-center space-y-1">
          <h3 className="text-lg font-semibold text-foreground">{t("siteAudit.emptyStateTitle")}</h3>
          <p className="text-sm text-muted-foreground max-w-sm">{t("siteAudit.emptyStateBody")}</p>
        </div>
        <Button onClick={onStart} disabled={isPending} className="gap-2">
          {isPending ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <Play className="w-4 h-4" />
          )}
          {t("siteAudit.runSiteAudit")}
        </Button>
      </CardContent>
    </Card>
  );
}

// ---------------------------------------------------------------------------
// Page component
// ---------------------------------------------------------------------------

function VisibilityAnalyticsBanner({ projectId }: { projectId: string }) {
  const { t } = useTranslation("projects");
  const latestRun = useLatestRun(projectId);
  const [showSuccess, setShowSuccess] = useState(false);
  const [dismissed, setDismissed] = useState(false);
  const prevStatusRef = useRef<string | null>(null);
  const initialisedRef = useRef(false);

  useEffect(() => {
    const status = latestRun.data?.status;
    if (latestRun.isLoading && !latestRun.data) return;
    if (!status) return;

    if (!initialisedRef.current) {
      initialisedRef.current = true;
      prevStatusRef.current = status;
      return;
    }

    const prev = prevStatusRef.current;
    prevStatusRef.current = status;

    if (status === "pending" || status === "running") {
      setDismissed(false);
      setShowSuccess(false);
      return;
    }

    if (
      (prev === "pending" || prev === "running") &&
      (status === "completed" || status === "partial")
    ) {
      setShowSuccess(true);
      const tid = window.setTimeout(() => {
        setDismissed(true);
        setShowSuccess(false);
      }, 7500);
      return () => window.clearTimeout(tid);
    }
  }, [latestRun.data, latestRun.isLoading]);

  const runStatus = latestRun.data?.status;
  const isRunActive = runStatus === "pending" || runStatus === "running";
  if (dismissed && !isRunActive && !showSuccess) return null;

  if (showSuccess) {
    return (
      <div className="rounded-xl border border-emerald-500/35 bg-emerald-50/90 dark:bg-emerald-950/50 p-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0 space-y-1">
          <p className="text-sm font-semibold text-emerald-900 dark:text-emerald-100">
            {t("visibilityAnalytics.bannerSuccessTitle")}
          </p>
          <p className="text-xs text-emerald-800/90 dark:text-emerald-200/90">
            {t("visibilityAnalytics.bannerSuccessBody")}
          </p>
        </div>
        <Button asChild size="sm" variant="secondary" className="shrink-0 border-emerald-600/30">
          <Link to="/visibility">{t("visibilityAnalytics.goToVisibility")}</Link>
        </Button>
      </div>
    );
  }

  if (latestRun.isLoading && !latestRun.data && !latestRun.isError) {
    return (
      <div className="rounded-xl border border-primary/20 bg-primary/5 p-5 flex flex-col sm:flex-row items-start sm:items-center gap-4">
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-foreground">{t("visibilityAnalytics.bannerStartingTitle")}</p>
          <p className="text-xs text-muted-foreground mt-0.5">{t("visibilityAnalytics.bannerStartingBody")}</p>
        </div>
        <Loader2 className="h-5 w-5 animate-spin text-primary shrink-0" aria-hidden />
      </div>
    );
  }

  if (!latestRun.data) return null;

  const status = latestRun.data.status;
  if (status === "pending" || status === "running") {
    return (
      <div className="rounded-xl border border-sky-500/25 bg-sky-50/80 dark:bg-sky-950/30 p-5 flex flex-col sm:flex-row items-start sm:items-center gap-4">
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-foreground">{t("visibilityAnalytics.bannerRunningTitle")}</p>
          <p className="text-xs text-muted-foreground mt-0.5">{t("visibilityAnalytics.bannerRunningBody")}</p>
        </div>
        <Loader2 className="h-5 w-5 animate-spin text-sky-600 dark:text-sky-400 shrink-0" aria-hidden />
      </div>
    );
  }

  return null;
}

function SiteAuditPage() {
  const { t } = useTranslation("projects");
  const { projectId } = useParams({
    from: "/_dashboard/projects/$projectId/site-audit",
  });

  const { data: audit, isLoading } = useLatestSiteAudit(projectId);
  const startAudit = useStartSiteAudit(projectId);

  const handleStart = () => {
    startAudit.mutate(undefined);
  };

  const handleDownloadPdf = async () => {
    if (!audit) return;
    const token = await getAccessToken();
    const baseUrl = import.meta.env.VITE_API_URL || "";
    const url = `${baseUrl}/api/v1/projects/${projectId}/site-audit/${audit.id}/report.pdf`;
    const res = await fetch(url, {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    });
    if (!res.ok) return;
    const blob = await res.blob();
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `geo-audit-${audit.id}.pdf`;
    a.click();
  };

  const isActive =
    audit?.status === "pending" || audit?.status === "running";

  return (
    <div className="space-y-6">
      <VisibilityAnalyticsBanner projectId={projectId} />

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-foreground">{t("siteAudit.pageTitle")}</h2>
          <p className="text-sm text-muted-foreground">{t("siteAudit.pageSubtitle")}</p>
        </div>
        <div className="flex items-center gap-2">
          {audit?.status === "completed" && (
            <Button
              variant="outline"
              size="sm"
              onClick={handleDownloadPdf}
              className="gap-2"
            >
              <Download className="w-4 h-4" />
              Download PDF
            </Button>
          )}
          <Button
            size="sm"
            onClick={handleStart}
            disabled={startAudit.isPending || isActive}
            className="gap-2"
          >
            {startAudit.isPending || isActive ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <RefreshCw className="w-4 h-4" />
            )}
            {isActive ? "Running..." : audit ? "Re-run Audit" : "Run Audit"}
          </Button>
        </div>
      </div>

      {/* Status bar */}
      {audit && (
        <div className="rounded-lg border bg-background/60 p-3">
          <div className="flex flex-wrap items-center gap-3">
            <StatusBadge status={audit.status} />
            <span className="min-w-0 flex-1 break-all text-sm text-muted-foreground">
              {audit.url}
            </span>
            {audit.status === "completed" && (
              <span className="ml-auto text-sm font-semibold">
                Audited:{" "}
                {new Date(audit.created_at).toLocaleDateString("en-US", {
                  month: "short",
                  day: "numeric",
                  year: "numeric",
                })}
              </span>
            )}
            {audit.status === "failed" && audit.error_message && (
              <span className="ml-auto max-w-full text-xs text-destructive">
                {audit.error_message}
              </span>
            )}
          </div>
          {isActive ? (
            <RunningAuditStatus
              startedAtIso={audit.started_at ?? audit.created_at}
            />
          ) : null}
        </div>
      )}

      {/* Content */}
      {isLoading ? (
        <AuditSkeleton />
      ) : !audit ? (
        <NoAuditState
          onStart={handleStart}
          isPending={startAudit.isPending}
        />
      ) : isActive ? (
        <AuditSkeleton />
      ) : audit.status === "failed" ? (
        <Card>
          <CardContent className="py-10 text-center space-y-3">
            <AlertCircle className="w-10 h-10 text-destructive mx-auto" />
            <p className="text-sm text-foreground font-medium">Audit failed</p>
            {audit.error_message && (
              <p className="text-xs text-muted-foreground">{audit.error_message}</p>
            )}
            <Button size="sm" onClick={handleStart} disabled={startAudit.isPending}>
              Retry Audit
            </Button>
          </CardContent>
        </Card>
      ) : audit.result_json ? (
        <AuditResults result={audit.result_json} />
      ) : null}
    </div>
  );
}
