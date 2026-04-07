import { useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  ArrowLeft,
  Loader2,
  Zap,
  Coins,
  Activity,
} from "lucide-react";
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import { useAdminTenantUsage, useUpdateAdminTenantQuota } from "@/hooks/use-admin-usage";

export const Route = createFileRoute(
  "/_dashboard/admin/ai-usage/$tenantId"
)({
  component: TenantUsageDetailPage,
});

function TenantUsageDetailPage() {
  const { tenantId } = Route.useParams();
  const { t } = useTranslation("admin");
  const { data, isLoading } = useAdminTenantUsage(tenantId);

  const formatNumber = (n: number) => new Intl.NumberFormat().format(n);
  const formatCost = (n: number) =>
    new Intl.NumberFormat(undefined, {
      style: "currency",
      currency: "USD",
    }).format(n);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-24">
        <Loader2 className="w-6 h-6 animate-spin" />
      </div>
    );
  }

  if (!data) return null;

  return (
    <div className="space-y-8">
      <div className="flex items-center gap-4">
        <Link to="/admin/ai-usage">
          <Button variant="ghost" size="icon">
            <ArrowLeft className="w-4 h-4" />
          </Button>
        </Link>
        <div>
          <h2 className="text-2xl font-bold text-foreground">
            {t("aiUsage.title")}
          </h2>
          <p className="text-sm text-muted-foreground mt-1">
            {t("aiUsage.thisMonth")}
          </p>
        </div>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-muted">
                <Zap className="w-5 h-5 text-teal-600" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">
                  {t("aiUsage.totalRequests")}
                </p>
                <p className="text-2xl font-bold">
                  {formatNumber(data.summary.total_requests)}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-muted">
                <Activity className="w-5 h-5 text-blue-600" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">
                  {t("aiUsage.totalTokens")}
                </p>
                <p className="text-2xl font-bold">
                  {formatNumber(data.summary.total_tokens)}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-muted">
                <Coins className="w-5 h-5 text-amber-600" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">
                  {t("aiUsage.totalCost")}
                </p>
                <p className="text-2xl font-bold">
                  {formatCost(data.summary.total_cost_usd)}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Usage over time */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">
              {t("aiUsage.usageOverTime")}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {data.timeseries.length > 0 ? (
              <ResponsiveContainer width="100%" height={300}>
                <LineChart data={data.timeseries}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis
                    dataKey="date"
                    tickFormatter={(v) =>
                      new Date(v).toLocaleDateString(undefined, {
                        month: "short",
                        day: "numeric",
                      })
                    }
                    fontSize={12}
                  />
                  <YAxis fontSize={12} />
                  <Tooltip
                    labelFormatter={(v) =>
                      new Date(v).toLocaleDateString()
                    }
                    formatter={(value) => [
                      formatNumber(Number(value)),
                      t("aiUsage.tokens"),
                    ]}
                  />
                  <Line
                    type="monotone"
                    dataKey="total_tokens"
                    stroke="hsl(var(--primary))"
                    strokeWidth={2}
                    dot={false}
                  />
                </LineChart>
              </ResponsiveContainer>
            ) : (
              <p className="text-center text-muted-foreground py-12">
                {t("aiUsage.noUsage")}
              </p>
            )}
          </CardContent>
        </Card>

        {/* Usage by provider */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">
              {t("aiUsage.usageByProvider")}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {data.breakdown.by_provider.length > 0 ? (
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={data.breakdown.by_provider}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="provider" fontSize={12} />
                  <YAxis fontSize={12} />
                  <Tooltip
                    formatter={(value) => [
                      formatCost(Number(value)),
                      t("aiUsage.cost"),
                    ]}
                  />
                  <Bar
                    dataKey="total_cost_usd"
                    fill="hsl(var(--primary))"
                    radius={[4, 4, 0, 0]}
                  />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <p className="text-center text-muted-foreground py-12">
                {t("aiUsage.noUsage")}
              </p>
            )}
          </CardContent>
        </Card>
      </div>

      {/* By model breakdown */}
      {data.breakdown.by_model.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">
              {t("aiUsage.usageByModel")}
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t("aiKeys.provider")}</TableHead>
                  <TableHead>{t("aiUsage.usageByModel")}</TableHead>
                  <TableHead className="text-right">
                    {t("aiUsage.requests")}
                  </TableHead>
                  <TableHead className="text-right">
                    {t("aiUsage.tokens")}
                  </TableHead>
                  <TableHead className="text-right">
                    {t("aiUsage.cost")}
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.breakdown.by_model.map((m) => (
                  <TableRow key={`${m.provider}-${m.model}`}>
                    <TableCell>{m.provider}</TableCell>
                    <TableCell className="font-mono text-sm">
                      {m.model}
                    </TableCell>
                    <TableCell className="text-right">
                      {formatNumber(m.total_requests)}
                    </TableCell>
                    <TableCell className="text-right">
                      {formatNumber(m.total_tokens)}
                    </TableCell>
                    <TableCell className="text-right">
                      {formatCost(m.total_cost_usd)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      {/* Quota config */}
      <QuotaConfigCard tenantId={tenantId} quotaStatus={data.quota_status} />
    </div>
  );
}

function QuotaConfigCard({
  tenantId,
  quotaStatus,
}: {
  tenantId: string;
  quotaStatus: NonNullable<
    ReturnType<typeof useAdminTenantUsage>["data"]
  >["quota_status"];
}) {
  const { t } = useTranslation("admin");
  const updateMutation = useUpdateAdminTenantQuota(tenantId);
  const [tokenBudget, setTokenBudget] = useState(
    quotaStatus.tokens_limit?.toString() ?? ""
  );
  const [rpm, setRpm] = useState(
    quotaStatus.requests_day_limit?.toString() ?? ""
  );
  const [warningPct, setWarningPct] = useState(
    quotaStatus.warning_threshold_pct.toString()
  );

  const handleSave = () => {
    updateMutation.mutate({
      monthly_token_budget: tokenBudget ? parseInt(tokenBudget) : null,
      requests_per_day: rpm ? parseInt(rpm) : null,
      warning_threshold_pct: parseInt(warningPct) || 80,
    });
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">{t("aiUsage.quota.title")}</CardTitle>
        <CardDescription>{t("aiUsage.quota.subtitle")}</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="space-y-2">
            <Label>{t("aiUsage.quota.monthlyTokenBudget")}</Label>
            <Input
              type="number"
              value={tokenBudget}
              onChange={(e) => setTokenBudget(e.target.value)}
              placeholder={t("aiUsage.quota.unlimited")}
            />
          </div>
          <div className="space-y-2">
            <Label>{t("aiUsage.quota.requestsPerDay")}</Label>
            <Input
              type="number"
              value={rpm}
              onChange={(e) => setRpm(e.target.value)}
              placeholder={t("aiUsage.quota.unlimited")}
            />
          </div>
          <div className="space-y-2">
            <Label>{t("aiUsage.quota.warningThreshold")}</Label>
            <Input
              type="number"
              value={warningPct}
              onChange={(e) => setWarningPct(e.target.value)}
              min={1}
              max={100}
            />
          </div>
        </div>
        <Button
          className="mt-4"
          onClick={handleSave}
          disabled={updateMutation.isPending}
        >
          {updateMutation.isPending && (
            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
          )}
          {t("aiUsage.quota.save")}
        </Button>
      </CardContent>
    </Card>
  );
}
