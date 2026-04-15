import { useTranslation } from "react-i18next";
import { PieChart as PieChartIcon } from "lucide-react";
import {
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
} from "recharts";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { useLocale } from "@/hooks/use-locale";
import { formatDate } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { ProjectSovResponse } from "@/types/project-sov";

const CLIENT_FILL = "#14b8a6";

const PALETTE = [
  "#8b5cf6",
  "#f59e0b",
  "#64748b",
  "#ec4899",
  "#3b82f6",
  "#22c55e",
];

interface ShareOfVoiceChartProps {
  data: ProjectSovResponse | undefined;
  isLoading: boolean;
}

export function ShareOfVoiceChart({ data, isLoading }: ShareOfVoiceChartProps) {
  const { t } = useTranslation("visibility");
  const { locale } = useLocale();

  if (isLoading) {
    return (
      <Card>
        <CardHeader className="space-y-2">
          <Skeleton className="h-5 w-40" />
          <Skeleton className="h-4 w-56" />
        </CardHeader>
        <CardContent>
          <Skeleton className="h-10 w-24" />
          <Skeleton className="mt-4 h-48 w-full" />
        </CardContent>
      </Card>
    );
  }

  if (!data || data.brands.length === 0) {
    return (
      <Card>
        <CardHeader>
          <div className="flex flex-row items-center gap-2">
            <PieChartIcon className="h-4 w-4 text-teal-600" />
            <CardTitle className="text-base">{t("sov.title")}</CardTitle>
          </div>
          <CardDescription>{t("sov.subtitle")}</CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">{t("sov.empty")}</p>
        </CardContent>
      </Card>
    );
  }

  const sorted = [...data.brands].sort((a, b) => b.sov_pct - a.sov_pct);
  const client = sorted.find((b) => b.is_client);

  const pieData = sorted.map((b) => ({
    name: b.domain.length > 28 ? `${b.domain.slice(0, 26)}…` : b.domain,
    fullName: b.domain,
    value: Math.max(0, b.sov_pct),
    isClient: b.is_client,
  }));

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-row items-center gap-2">
          <PieChartIcon className="h-4 w-4 text-teal-600" />
          <CardTitle className="text-base">{t("sov.title")}</CardTitle>
        </div>
        <CardDescription>{t("sov.subtitle")}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="mb-2">
          <span className="text-3xl font-bold tabular-nums text-foreground">
            {client != null ? `${client.sov_pct.toFixed(1)}%` : "—"}
          </span>
          <p className="text-xs text-muted-foreground mt-1">{t("sov.yourShare")}</p>
        </div>

        <div className="grid gap-6 md:grid-cols-2 md:items-center">
          <div className="mx-auto w-full max-w-[280px]">
            <ResponsiveContainer width="100%" height={220}>
              <PieChart>
                <Pie
                  data={pieData}
                  dataKey="value"
                  nameKey="name"
                  cx="50%"
                  cy="50%"
                  innerRadius={44}
                  outerRadius={88}
                  paddingAngle={1}
                >
                  {pieData.map((entry, index) => (
                    <Cell
                      key={`cell-${entry.fullName}`}
                      fill={entry.isClient ? CLIENT_FILL : PALETTE[index % PALETTE.length]}
                      stroke="transparent"
                    />
                  ))}
                </Pie>
                <Tooltip
                  formatter={(value) => [
                    `${Number(value ?? 0).toFixed(1)}%`,
                    t("sov.share"),
                  ]}
                />
              </PieChart>
            </ResponsiveContainer>
          </div>

          <div className="min-w-0 space-y-3">
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              {t("sov.barsLabel")}
            </p>
            {sorted.map((b) => (
              <div key={b.domain} className="space-y-1">
                <div className="flex items-center justify-between gap-2 text-xs">
                  <span className="flex min-w-0 items-center gap-2">
                    <span className="truncate text-foreground">{b.domain}</span>
                    {b.is_client ? (
                      <Badge variant="secondary" className="shrink-0 text-[10px]">
                        {t("sov.you")}
                      </Badge>
                    ) : null}
                  </span>
                  <span className="shrink-0 font-medium tabular-nums text-foreground">
                    {b.sov_pct.toFixed(1)}%
                  </span>
                </div>
                <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
                  <div
                    className={cn(
                      "h-full rounded-full transition-all",
                      b.is_client ? "bg-primary" : "bg-muted-foreground/50",
                    )}
                    style={{ width: `${Math.min(100, b.sov_pct)}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>

        <p className="text-xs text-muted-foreground">
          {t("sov.tracked", { count: data.total_tracked_brands })} ·{" "}
          {formatDate(data.updated_at, locale)}
        </p>
      </CardContent>
    </Card>
  );
}
