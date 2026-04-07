import type { ReactNode } from "react";
import { useTranslation } from "react-i18next";
import {
  AlertCircle,
  FileBarChart,
  Swords,
  TrendingUp,
} from "lucide-react";
import {
  Badge,
} from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { useLocale } from "@/hooks/use-locale";
import { formatDate } from "@/lib/format";
import { formatVisibilityScore } from "@/lib/report";
import type {
  CompetitiveAnalysisData,
  ContentPerformanceData,
  EntityMentionSummary,
  PublicReport,
  Report,
  ReportEngineBreakdown,
  ReportRunSummary,
  ReportTopGap,
  ReportType,
  VisibilityAuditData,
} from "@/types/report";

function getReportMeta(reportType: ReportType, t: (key: string) => string) {
  switch (reportType) {
    case "visibility_audit":
      return {
        icon: FileBarChart,
        label: t("types.visibility_audit"),
        badgeClassName: "bg-teal-50 text-teal-700 border-teal-200",
      };
    case "competitive_analysis":
      return {
        icon: Swords,
        label: t("types.competitive_analysis"),
        badgeClassName: "bg-purple-50 text-purple-700 border-purple-200",
      };
    case "content_performance":
      return {
        icon: TrendingUp,
        label: t("types.content_performance"),
        badgeClassName: "bg-green-50 text-green-700 border-green-200",
      };
  }
}

function isRunSummary(summary: unknown): summary is ReportRunSummary {
  return Boolean(
    summary &&
      typeof summary === "object" &&
      "avg_total" in summary &&
      "score_count" in summary,
  );
}

function isVisibilityAuditData(data: unknown): data is VisibilityAuditData {
  return Boolean(
    data &&
      typeof data === "object" &&
      "report_type" in data &&
      data.report_type === "visibility_audit",
  );
}

function isCompetitiveAnalysisData(
  data: unknown,
): data is CompetitiveAnalysisData {
  return Boolean(
    data &&
      typeof data === "object" &&
      "report_type" in data &&
      data.report_type === "competitive_analysis",
  );
}

function isContentPerformanceData(data: unknown): data is ContentPerformanceData {
  return Boolean(
    data &&
      typeof data === "object" &&
      "report_type" in data &&
      data.report_type === "content_performance",
  );
}

function MetricCard({
  label,
  value,
  description,
}: {
  label: string;
  value: string;
  description?: string;
}) {
  return (
    <Card className="border-border/70">
      <CardContent className="space-y-1 py-5">
        <p className="text-xs uppercase tracking-[0.16em] text-muted-foreground">
          {label}
        </p>
        <p className="text-3xl font-semibold text-foreground">{value}</p>
        {description ? (
          <p className="text-xs text-muted-foreground">{description}</p>
        ) : null}
      </CardContent>
    </Card>
  );
}

function SentimentBreakdown({
  values,
}: {
  values: Record<string, number>;
}) {
  return (
    <div className="flex flex-wrap gap-2">
      {Object.entries(values).map(([label, count]) => (
        <Badge key={label} variant="outline" className="capitalize">
          {label}: {count}
        </Badge>
      ))}
    </div>
  );
}

function EngineBreakdownSection({
  items,
}: {
  items: ReportEngineBreakdown[];
}) {
  const { t } = useTranslation("reports");

  if (items.length === 0) {
    return null;
  }

  return (
    <section className="space-y-4">
      <div>
        <h3 className="text-lg font-semibold text-foreground">
          {t("detail.sections.engineBreakdown")}
        </h3>
        <p className="text-sm text-muted-foreground">
          {t("detail.sections.engineBreakdownHint")}
        </p>
      </div>
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {items.map((item) => (
          <Card key={item.engine_id}>
            <CardContent className="space-y-4 py-5">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-base font-semibold text-foreground">
                    {item.engine_name ?? t("detail.unknownEngine")}
                  </p>
                  <p className="text-sm text-muted-foreground">
                    {t("detail.queryCount", { count: item.score_count })}
                  </p>
                </div>
                <Badge variant="outline" className="bg-muted/40">
                  {formatVisibilityScore(item.avg_total)}/10
                </Badge>
              </div>
              <div className="grid grid-cols-2 gap-3 text-sm">
                <DetailStat
                  label={t("detail.labels.mention")}
                  value={formatVisibilityScore(item.avg_mention)}
                />
                <DetailStat
                  label={t("detail.labels.sentiment")}
                  value={formatVisibilityScore(item.avg_sentiment)}
                />
                <DetailStat
                  label={t("detail.labels.citation")}
                  value={formatVisibilityScore(item.avg_citation)}
                />
                <DetailStat
                  label={t("detail.labels.recommendation")}
                  value={formatVisibilityScore(item.avg_recommendation)}
                />
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </section>
  );
}

function DetailStat({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-lg border border-border/60 bg-muted/20 px-3 py-2">
      <p className="text-[11px] uppercase tracking-[0.14em] text-muted-foreground">
        {label}
      </p>
      <p className="mt-1 font-medium text-foreground">{value}</p>
    </div>
  );
}

function EntitySummaryCard({
  title,
  entity,
}: {
  title: string;
  entity: EntityMentionSummary;
}) {
  const { t } = useTranslation("reports");

  return (
    <Card>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
        <CardDescription>{entity.name}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-2 gap-3">
          <DetailStat
            label={t("detail.labels.mentions")}
            value={String(entity.total_mentions)}
          />
          <DetailStat
            label={t("detail.labels.avgPosition")}
            value={
              entity.avg_position != null
                ? formatVisibilityScore(entity.avg_position)
                : t("detail.notAvailable")
            }
          />
        </div>
        <SentimentBreakdown values={entity.sentiment_breakdown} />
      </CardContent>
    </Card>
  );
}

function TopGapsSection({
  gaps,
}: {
  gaps: ReportTopGap[];
}) {
  const { t } = useTranslation("reports");

  if (gaps.length === 0) {
    return null;
  }

  return (
    <section className="space-y-4">
      <div>
        <h3 className="text-lg font-semibold text-foreground">
          {t("detail.sections.topGaps")}
        </h3>
        <p className="text-sm text-muted-foreground">
          {t("detail.sections.topGapsHint")}
        </p>
      </div>
      <div className="grid gap-4 md:grid-cols-3">
        {gaps.map((gap) => (
          <Card key={gap.dimension}>
            <CardContent className="space-y-2 py-5">
              <p className="text-sm font-medium capitalize text-foreground">
                {gap.dimension}
              </p>
              <p className="text-3xl font-semibold text-foreground">
                {formatVisibilityScore(gap.avg_score)}
              </p>
              <p className="text-xs text-muted-foreground">
                {t("detail.lowestScoringDimension")}
              </p>
            </CardContent>
          </Card>
        ))}
      </div>
    </section>
  );
}

function VisibilityAuditSections({ data }: { data: VisibilityAuditData }) {
  const { t } = useTranslation("reports");

  return (
    <div className="space-y-8">
      {isRunSummary(data.summary) ? (
        <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <MetricCard
            label={t("metrics.overallScore")}
            value={`${formatVisibilityScore(data.summary.avg_total)}/10`}
            description={t("detail.queryCount", {
              count: data.summary.score_count,
            })}
          />
          <MetricCard
            label={t("metrics.queriesAnalyzed")}
            value={String(data.summary.score_count)}
          />
          <MetricCard
            label={t("detail.labels.citation")}
            value={formatVisibilityScore(data.summary.avg_citation)}
          />
          <MetricCard
            label={t("detail.labels.recommendation")}
            value={formatVisibilityScore(data.summary.avg_recommendation)}
          />
        </section>
      ) : (
        <MessageCard message={data.summary.message} />
      )}

      <EngineBreakdownSection items={data.by_engine} />
      <TopGapsSection gaps={data.top_gaps} />

      {data.competitor_mentions.length > 0 ? (
        <section className="space-y-4">
          <div>
            <h3 className="text-lg font-semibold text-foreground">
              {t("detail.sections.competitors")}
            </h3>
            <p className="text-sm text-muted-foreground">
              {t("detail.sections.competitorsHint")}
            </p>
          </div>
          <div className="grid gap-4 md:grid-cols-2">
            {data.competitor_mentions.map((competitor) => (
              <EntitySummaryCard
                key={competitor.name}
                title={competitor.name}
                entity={competitor}
              />
            ))}
          </div>
        </section>
      ) : null}
    </div>
  );
}

function CompetitiveAnalysisSections({
  data,
}: {
  data: CompetitiveAnalysisData;
}) {
  const { t } = useTranslation("reports");

  return (
    <div className="space-y-8">
      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <MetricCard
          label={t("detail.labels.mentions")}
          value={String(data.brand_mentions.total_mentions)}
          description={t("detail.brandMentions")}
        />
        <MetricCard
          label={t("detail.labels.avgPosition")}
          value={
            data.brand_mentions.avg_position != null
              ? formatVisibilityScore(data.brand_mentions.avg_position)
              : t("detail.notAvailable")
          }
        />
        <MetricCard
          label={t("detail.labels.answers")}
          value={String(data.positioning.total_answers ?? 0)}
        />
        <MetricCard
          label={t("metrics.competitors")}
          value={String(data.competitor_analysis.length)}
        />
      </section>

      <EntitySummaryCard
        title={t("detail.sections.brandCoverage")}
        entity={data.brand_mentions}
      />

      {data.competitor_analysis.length > 0 ? (
        <section className="space-y-4">
          <div>
            <h3 className="text-lg font-semibold text-foreground">
              {t("detail.sections.competitorAnalysis")}
            </h3>
            <p className="text-sm text-muted-foreground">
              {t("detail.sections.competitorAnalysisHint")}
            </p>
          </div>
          <div className="grid gap-4 md:grid-cols-2">
            {data.competitor_analysis.map((competitor) => (
              <EntitySummaryCard
                key={competitor.name}
                title={competitor.name}
                entity={competitor}
              />
            ))}
          </div>
        </section>
      ) : null}

      {data.positioning.message ? (
        <MessageCard message={data.positioning.message} />
      ) : data.positioning.competitors && data.positioning.competitors.length > 0 ? (
        <section className="space-y-4">
          <div>
            <h3 className="text-lg font-semibold text-foreground">
              {t("detail.sections.positioning")}
            </h3>
            <p className="text-sm text-muted-foreground">
              {t("detail.sections.positioningHint")}
            </p>
          </div>
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {data.positioning.competitors.map((entry) => (
              <Card key={entry.name}>
                <CardContent className="space-y-4 py-5">
                  <div className="flex items-center justify-between gap-3">
                    <p className="text-base font-semibold text-foreground">
                      {entry.name}
                    </p>
                    <Badge variant="outline">
                      {entry.mention_rate_pct.toFixed(1)}%
                    </Badge>
                  </div>
                  <SentimentBreakdown values={entry.sentiment_breakdown} />
                </CardContent>
              </Card>
            ))}
          </div>
        </section>
      ) : null}
    </div>
  );
}

function ContentPerformanceSections({
  data,
}: {
  data: ContentPerformanceData;
}) {
  const { t } = useTranslation("reports");
  const { locale } = useLocale();
  const topPerformer = [...data.score_proxy].sort(
    (a, b) => b.avg_total - a.avg_total,
  )[0];
  const avgCitation =
    data.score_proxy.length > 0
      ? data.score_proxy.reduce((sum, item) => sum + item.avg_citation, 0) /
        data.score_proxy.length
      : 0;

  return (
    <div className="space-y-8">
      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <MetricCard
          label={t("detail.labels.contentItems")}
          value={String(data.published_content_count)}
        />
        <MetricCard
          label={t("metrics.enginesTracked")}
          value={String(data.score_proxy.length)}
        />
        <MetricCard
          label={t("metrics.topPerformer")}
          value={topPerformer?.engine_name ?? t("detail.notAvailable")}
        />
        <MetricCard
          label={t("metrics.avgCitations")}
          value={formatVisibilityScore(avgCitation)}
        />
      </section>

      <section className="space-y-4">
        <div>
          <h3 className="text-lg font-semibold text-foreground">
            {t("detail.sections.contentInventory")}
          </h3>
          <p className="text-sm text-muted-foreground">
            {t("detail.sections.contentInventoryHint")}
          </p>
        </div>
        {data.content_items.length > 0 ? (
          <div className="grid gap-4 md:grid-cols-2">
            {data.content_items.map((item) => (
              <Card key={item.id}>
                <CardContent className="space-y-3 py-5">
                  <div className="flex items-start justify-between gap-3">
                    <p className="font-medium text-foreground">{item.title}</p>
                    <ContentTypeBadge type={item.content_type} />
                  </div>
                  <p className="text-sm text-muted-foreground">
                    {item.published_at
                      ? t("detail.publishedAt", {
                          date: formatDate(item.published_at, locale),
                        })
                      : t("detail.unpublished")}
                  </p>
                </CardContent>
              </Card>
            ))}
          </div>
        ) : (
          <MessageCard message={t("detail.noContent")} />
        )}
      </section>

      <EngineBreakdownSection items={data.score_proxy} />
    </div>
  );
}

function ContentTypeBadge({ type }: { type: string }) {
  const { t } = useTranslation("common");
  const label = t(`contentType.${type}`);
  return <Badge variant="outline">{label === `contentType.${type}` ? type : label}</Badge>;
}

function MessageCard({ message }: { message: string }) {
  return (
    <Card className="border-dashed">
      <CardContent className="flex items-start gap-3 py-5">
        <AlertCircle className="mt-0.5 h-4 w-4 text-muted-foreground" />
        <p className="text-sm text-muted-foreground">{message}</p>
      </CardContent>
    </Card>
  );
}

export function ReportDetailView({
  report,
  headerActions,
  publicBadge,
}: {
  report: Report | PublicReport;
  headerActions?: ReactNode;
  publicBadge?: ReactNode;
}) {
  const { t } = useTranslation("reports");
  const { locale } = useLocale();
  const meta = getReportMeta(report.report_type, t);
  const Icon = meta.icon;

  return (
    <div className="space-y-8">
      <Card className="border-border/70">
        <CardHeader className="gap-4">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
            <div className="space-y-3">
              <div className="flex flex-wrap items-center gap-2">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-teal-50 text-teal-700">
                  <Icon className="h-5 w-5" />
                </div>
                <Badge variant="outline" className={meta.badgeClassName}>
                  {meta.label}
                </Badge>
                {publicBadge}
              </div>
              <div>
                <CardTitle className="text-2xl">{report.title}</CardTitle>
                <CardDescription className="mt-2">
                  {formatDate(report.created_at, locale, {
                    year: "numeric",
                    month: "long",
                    day: "numeric",
                  })}
                </CardDescription>
              </div>
            </div>
            {headerActions ? <div>{headerActions}</div> : null}
          </div>
        </CardHeader>
      </Card>

      {isVisibilityAuditData(report.data) ? (
        <VisibilityAuditSections data={report.data} />
      ) : isCompetitiveAnalysisData(report.data) ? (
        <CompetitiveAnalysisSections data={report.data} />
      ) : isContentPerformanceData(report.data) ? (
        <ContentPerformanceSections data={report.data} />
      ) : (
        <MessageCard message={t("detail.unknownShape")} />
      )}
    </div>
  );
}
