import { useTranslation } from "react-i18next";
import {
  Area,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
  AreaChart,
} from "recharts";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import type { ProjectTrendsResponse } from "@/types/project-trends";

interface VisibilityWeeklyTrendsProps {
  data: ProjectTrendsResponse | undefined;
  isLoading: boolean;
}

export function VisibilityWeeklyTrends({
  data,
  isLoading,
}: VisibilityWeeklyTrendsProps) {
  const { t } = useTranslation("visibility");

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <Skeleton className="h-5 w-56" />
          <Skeleton className="h-4 w-72" />
        </CardHeader>
        <CardContent>
          <Skeleton className="h-[280px] w-full rounded-lg" />
        </CardContent>
      </Card>
    );
  }

  if (!data || data.labels.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>{t("weeklyTrend.title")}</CardTitle>
          <CardDescription>{t("weeklyTrend.subtitle")}</CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">{t("weeklyTrend.empty")}</p>
        </CardContent>
      </Card>
    );
  }

  const sov = data.series.sov ?? [];
  const vis = data.series.visibility ?? [];
  const chartData = data.labels.map((label, i) => ({
    week: label,
    sov: sov[i] ?? 0,
    visibility: vis[i] ?? 0,
  }));

  const hasSignal = chartData.some(
    (row) => row.sov > 0 || row.visibility > 0,
  );

  if (!hasSignal) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>{t("weeklyTrend.title")}</CardTitle>
          <CardDescription>{t("weeklyTrend.subtitle")}</CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">{t("weeklyTrend.empty")}</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t("weeklyTrend.title")}</CardTitle>
        <CardDescription>{t("weeklyTrend.subtitle")}</CardDescription>
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={280}>
          <AreaChart data={chartData} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
            <defs>
              <linearGradient id="sovFill" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#8b5cf6" stopOpacity={0.35} />
                <stop offset="100%" stopColor="#8b5cf6" stopOpacity={0} />
              </linearGradient>
              <linearGradient id="visFill" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#14b8a6" stopOpacity={0.35} />
                <stop offset="100%" stopColor="#14b8a6" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
            <XAxis
              dataKey="week"
              tick={{ fontSize: 11 }}
              className="fill-muted-foreground"
            />
            <YAxis
              domain={[0, 100]}
              tick={{ fontSize: 11 }}
              className="fill-muted-foreground"
              width={36}
            />
            <Tooltip
              contentStyle={{
                borderRadius: 8,
                border: "1px solid var(--border)",
                backgroundColor: "var(--popover)",
                color: "var(--popover-foreground)",
              }}
            />
            <Legend wrapperStyle={{ fontSize: 12 }} />
            <Area
              type="monotone"
              dataKey="sov"
              name={t("weeklyTrend.sov")}
              stroke="#8b5cf6"
              fill="url(#sovFill)"
              strokeWidth={2}
            />
            <Area
              type="monotone"
              dataKey="visibility"
              name={t("weeklyTrend.visibility")}
              stroke="#14b8a6"
              fill="url(#visFill)"
              strokeWidth={2}
            />
          </AreaChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
}
