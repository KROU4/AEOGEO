import { useTranslation } from "react-i18next";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import type { ProjectDashboardResponse } from "@/types/project-dashboard";

function Delta({ value, inverted }: { value: number; inverted?: boolean }) {
  const good = inverted ? value <= 0 : value >= 0;
  const cls = good ? "text-emerald-600 dark:text-emerald-400" : "text-red-600 dark:text-red-400";
  const formatted = `${value >= 0 ? "+" : ""}${value.toFixed(1)}`;
  return <span className={`text-xs font-medium ${cls}`}>{formatted}</span>;
}

function KpiCell({
  label,
  value,
  suffix,
  delta,
  invertDelta,
}: {
  label: string;
  value: number;
  suffix: string;
  delta: number;
  invertDelta?: boolean;
}) {
  return (
    <div className="rounded-lg border border-border/60 bg-card/40 px-3 py-3 text-center">
      <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
        {label}
      </p>
      <p className="mt-1 text-2xl font-bold tabular-nums text-foreground">
        {value.toFixed(1)}
        <span className="text-sm font-normal text-muted-foreground">{suffix}</span>
      </p>
      <div className="mt-0.5">
        <Delta value={delta} inverted={invertDelta} />
      </div>
    </div>
  );
}

interface OverviewPeriodKpisProps {
  data: ProjectDashboardResponse | undefined;
  isLoading: boolean;
}

export function OverviewPeriodKpis({ data, isLoading }: OverviewPeriodKpisProps) {
  const { t } = useTranslation("dashboard");

  if (isLoading) {
    return (
      <Card>
        <CardHeader className="pb-2">
          <Skeleton className="h-5 w-40" />
          <Skeleton className="h-4 w-56" />
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            {[1, 2, 3, 4].map((i) => (
              <Skeleton key={i} className="h-24 rounded-lg" />
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  if (!data) return null;

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-base">{t("periodKpi.title")}</CardTitle>
        <CardDescription>{t("periodKpi.period", { period: data.period })}</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <KpiCell
            label={t("periodKpi.overall")}
            value={data.overall_score}
            suffix="/100"
            delta={data.overall_score_delta}
          />
          <KpiCell
            label={t("periodKpi.sov")}
            value={data.share_of_voice}
            suffix="%"
            delta={data.share_of_voice_delta}
          />
          <KpiCell
            label={t("periodKpi.rank")}
            value={data.avg_rank}
            suffix=""
            delta={data.avg_rank_delta}
            invertDelta
          />
          <KpiCell
            label={t("periodKpi.citations")}
            value={data.citation_rate}
            suffix="%"
            delta={data.citation_rate_delta}
          />
        </div>
      </CardContent>
    </Card>
  );
}
