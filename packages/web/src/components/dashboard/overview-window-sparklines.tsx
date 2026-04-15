import { useTranslation } from "react-i18next";
import {
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import type { ProjectDashboardResponse } from "@/types/project-dashboard";

interface OverviewWindowSparklinesProps {
  data: ProjectDashboardResponse | undefined;
  isLoading: boolean;
}

export function OverviewWindowSparklines({
  data,
  isLoading,
}: OverviewWindowSparklinesProps) {
  const { t } = useTranslation("dashboard");

  if (isLoading) {
    return (
      <Card>
        <CardHeader className="pb-2">
          <Skeleton className="h-5 w-48" />
          <Skeleton className="h-4 w-72" />
        </CardHeader>
        <CardContent>
          <Skeleton className="h-[200px] w-full rounded-lg" />
        </CardContent>
      </Card>
    );
  }

  if (!data) return null;

  const scoreSeries = data.sparklines?.score ?? [];
  const sovSeries = data.sparklines?.sov ?? [];
  if (scoreSeries.length === 0 && sovSeries.length === 0) return null;

  const len = Math.max(scoreSeries.length, sovSeries.length);
  const chartData = Array.from({ length: len }, (_, i) => ({
    run: i + 1,
    score: scoreSeries[i] ?? 0,
    sov: sovSeries[i] ?? 0,
  }));

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">{t("windowSparklines.title")}</CardTitle>
        <CardDescription>
          {t("windowSparklines.subtitle", { period: data.period })}
        </CardDescription>
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={220}>
          <LineChart data={chartData} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
            <XAxis
              dataKey="run"
              tick={{ fontSize: 11 }}
              className="fill-muted-foreground"
              tickFormatter={(v) => `#${v}`}
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
            <Line
              type="monotone"
              dataKey="score"
              name={t("windowSparklines.seriesScore")}
              stroke="var(--color-teal-500, #14b8a6)"
              strokeWidth={2}
              dot={{ r: 3 }}
            />
            <Line
              type="monotone"
              dataKey="sov"
              name={t("windowSparklines.seriesSov")}
              stroke="var(--color-violet-500, #8b5cf6)"
              strokeWidth={2}
              dot={{ r: 3 }}
            />
          </LineChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
}
