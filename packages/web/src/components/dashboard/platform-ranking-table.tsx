import { useTranslation } from "react-i18next";
import { Layers } from "lucide-react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type { DashboardPlatformsResponse } from "@/types/dashboard-platforms";

interface PlatformRankingTableProps {
  data: DashboardPlatformsResponse | undefined;
  isLoading: boolean;
}

export function PlatformRankingTable({ data, isLoading }: PlatformRankingTableProps) {
  const { t } = useTranslation("visibility");

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <Skeleton className="h-5 w-48" />
          <Skeleton className="h-4 w-64" />
        </CardHeader>
        <CardContent>
          <Skeleton className="h-40 w-full" />
        </CardContent>
      </Card>
    );
  }

  if (!data || data.platforms.length === 0) {
    return (
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Layers className="h-4 w-4 text-teal-600" />
            <CardTitle className="text-base">{t("platforms.title")}</CardTitle>
          </div>
          <CardDescription>{t("platforms.subtitle")}</CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">{t("platforms.empty")}</p>
        </CardContent>
      </Card>
    );
  }

  const rows = [...data.platforms].sort((a, b) => b.sov_pct - a.sov_pct);

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-2">
          <Layers className="h-4 w-4 text-teal-600" />
          <CardTitle className="text-base">{t("platforms.title")}</CardTitle>
        </div>
        <CardDescription>{t("platforms.subtitle")}</CardDescription>
      </CardHeader>
      <CardContent className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{t("platforms.engine")}</TableHead>
              <TableHead className="text-right">{t("platforms.sov")}</TableHead>
              <TableHead className="text-right">{t("platforms.visibility")}</TableHead>
              <TableHead className="text-right">{t("platforms.avgRank")}</TableHead>
              <TableHead className="text-right">{t("platforms.runs")}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((p) => (
              <TableRow key={p.engine}>
                <TableCell className="font-medium">{p.engine}</TableCell>
                <TableCell className="text-right tabular-nums">
                  {p.sov_pct.toFixed(1)}%
                </TableCell>
                <TableCell className="text-right tabular-nums">
                  {p.visibility_pct.toFixed(1)}%
                </TableCell>
                <TableCell className="text-right tabular-nums">
                  {p.avg_rank.toFixed(1)}
                </TableCell>
                <TableCell className="text-right tabular-nums">{p.run_count}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}
