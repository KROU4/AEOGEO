import { createFileRoute, useParams } from "@tanstack/react-router";
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
  type AuditIssue,
  type FullSiteAuditResult,
  type SiteAuditStatus,
} from "@/hooks/use-site-audit";
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

function scoreBg(score: number): string {
  if (score >= 70) return "bg-green-50 dark:bg-green-950 border-green-200 dark:border-green-800";
  if (score >= 45) return "bg-amber-50 dark:bg-amber-950 border-amber-200 dark:border-amber-800";
  return "bg-red-50 dark:bg-red-950 border-red-200 dark:border-red-800";
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
  const r = size === "lg" ? 44 : 28;
  const cx = size === "lg" ? 52 : 34;
  const cy = size === "lg" ? 52 : 34;
  const circumference = 2 * Math.PI * r;
  const offset = circumference - (score / 100) * circumference;
  const strokeColour =
    score >= 70 ? "#16a34a" : score >= 45 ? "#f59e0b" : "#dc2626";
  const viewBox =
    size === "lg" ? "0 0 104 104" : "0 0 68 68";
  const textSize = size === "lg" ? "text-xl" : "text-sm";
  const svgSize = size === "lg" ? 104 : 68;

  return (
    <div className="flex flex-col items-center gap-1">
      <div className="relative">
        <svg
          width={svgSize}
          height={svgSize}
          viewBox={viewBox}
          className="-rotate-90"
        >
          <circle
            cx={cx}
            cy={cy}
            r={r}
            fill="none"
            stroke="currentColor"
            className="text-muted"
            strokeWidth={size === "lg" ? 8 : 6}
          />
          <circle
            cx={cx}
            cy={cy}
            r={r}
            fill="none"
            stroke={strokeColour}
            strokeWidth={size === "lg" ? 8 : 6}
            strokeDasharray={circumference}
            strokeDashoffset={offset}
            strokeLinecap="round"
          />
        </svg>
        <div className="absolute inset-0 flex items-center justify-center">
          <span
            className={`${textSize} font-bold ${scoreColour(score)}`}
          >
            {score.toFixed(0)}
          </span>
        </div>
      </div>
      <p className="text-xs text-muted-foreground text-center leading-tight">{label}</p>
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
  return (
    <Card className={`border ${scoreBg(score)}`}>
      <CardContent className="pt-4 pb-3">
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-center gap-2">
            <div className="p-1.5 rounded-md bg-background/60">{icon}</div>
            <div>
              <p className="text-sm font-semibold text-foreground">{title}</p>
              <p className="text-xs text-muted-foreground">{description}</p>
            </div>
          </div>
          <span className={`text-2xl font-bold ${scoreColour(score)}`}>
            {score.toFixed(0)}
          </span>
        </div>
        <Progress
          value={score}
          className="mt-3 h-1.5"
        />
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
      <p className="text-sm text-muted-foreground">No issues detected.</p>
    );

  return (
    <div className="space-y-2">
      {issues.map((issue, i) => (
        <div
          key={i}
          className="flex items-start gap-3 rounded-lg border bg-background/60 p-3"
        >
          <div className="mt-0.5">{severityBadge(issue.severity)}</div>
          <div className="flex-1 min-w-0">
            <p className="text-sm text-foreground">{issue.message}</p>
            {issue.recommendation && (
              <p className="text-xs text-muted-foreground mt-0.5">
                {issue.recommendation}
              </p>
            )}
          </div>
          <Badge variant="outline" className="text-[10px] shrink-0">
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
          return (
            <TableRow key={bot}>
              <TableCell className="font-mono text-xs">{bot}</TableCell>
              <TableCell>
                <Badge
                  variant={isBlocked ? "destructive" : "outline"}
                  className={
                    !isBlocked
                      ? "bg-green-50 text-green-800 border-green-200 dark:bg-green-950 dark:text-green-300"
                      : ""
                  }
                >
                  {status}
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
  return (
    <div className="space-y-8">
      {/* Overall Score + Pillar overview */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card className="lg:col-span-1 flex flex-col items-center justify-center py-8">
          <ScoreGauge
            score={result.overall_geo_score}
            label="Overall GEO Score"
            size="lg"
          />
          <p className="text-xs text-muted-foreground mt-3 text-center px-4">
            Composite across citability, content, technical,<br />schema, platforms &amp; brand
          </p>
        </Card>

        <div className="lg:col-span-2 grid grid-cols-2 sm:grid-cols-3 gap-3">
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
          </CardHeader>
          <CardContent>
            <ol className="space-y-2 list-decimal list-inside">
              {result.top_recommendations.map((rec, i) => (
                <li key={i} className="text-sm text-foreground">
                  {rec}
                </li>
              ))}
            </ol>
          </CardContent>
        </Card>
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
            ].map(({ label, score, max }) => (
              <div key={label} className="flex flex-col items-center p-3 rounded-lg border bg-background/60">
                <span className={`text-xl font-bold ${scoreColour((score / max) * 100)}`}>
                  {score.toFixed(0)}
                  <span className="text-xs text-muted-foreground font-normal">/{max}</span>
                </span>
                <span className="text-xs text-muted-foreground">{label}</span>
              </div>
            ))}
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

function NoAuditState({
  projectId,
  onStart,
  isPending,
}: {
  projectId: string;
  onStart: () => void;
  isPending: boolean;
}) {
  return (
    <Card className="border-dashed">
      <CardContent className="flex flex-col items-center justify-center py-16 gap-4">
        <div className="p-4 rounded-full bg-teal-50 dark:bg-teal-950">
          <Globe className="w-8 h-8 text-teal-600 dark:text-teal-400" />
        </div>
        <div className="text-center space-y-1">
          <h3 className="text-lg font-semibold text-foreground">
            No site audit yet
          </h3>
          <p className="text-sm text-muted-foreground max-w-sm">
            Run a full GEO site audit to measure your AI citability, technical
            health, structured data, and platform readiness.
          </p>
        </div>
        <Button onClick={onStart} disabled={isPending} className="gap-2">
          {isPending ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <Play className="w-4 h-4" />
          )}
          Run Site Audit
        </Button>
      </CardContent>
    </Card>
  );
}

// ---------------------------------------------------------------------------
// Page component
// ---------------------------------------------------------------------------

function SiteAuditPage() {
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
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-foreground">GEO Site Audit</h2>
          <p className="text-sm text-muted-foreground">
            Comprehensive AI visibility analysis — technical, schema, content &amp; platforms.
          </p>
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
        <div className="flex items-center gap-3 p-3 rounded-lg border bg-background/60">
          <StatusBadge status={audit.status} />
          <span className="text-sm text-muted-foreground">
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
          {isActive && (
            <div className="ml-auto flex items-center gap-2">
              <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />
              <span className="text-xs text-muted-foreground">
                Analysing site — this takes about 30–60 seconds…
              </span>
            </div>
          )}
          {audit.status === "failed" && audit.error_message && (
            <span className="ml-auto text-xs text-destructive">
              {audit.error_message}
            </span>
          )}
        </div>
      )}

      {/* Content */}
      {isLoading ? (
        <AuditSkeleton />
      ) : !audit ? (
        <NoAuditState
          projectId={projectId}
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
