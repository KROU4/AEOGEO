import { createFileRoute, Link } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Loader2,
  Zap,
  Coins,
  Users,
  Activity,
} from "lucide-react";
import { useAdminTenantsUsage } from "@/hooks/use-admin-usage";

export const Route = createFileRoute("/_dashboard/admin/ai-usage")({
  component: AIUsagePage,
});

function AIUsagePage() {
  const { t } = useTranslation("admin");
  const { data: tenants, isLoading } = useAdminTenantsUsage();

  const totals = tenants?.reduce(
    (acc, t) => ({
      requests: acc.requests + t.total_requests,
      tokens: acc.tokens + t.total_tokens,
      cost: acc.cost + t.total_cost_usd,
    }),
    { requests: 0, tokens: 0, cost: 0 }
  ) ?? { requests: 0, tokens: 0, cost: 0 };

  const activeTenants = tenants?.filter((t) => t.total_requests > 0).length ?? 0;

  const formatNumber = (n: number) =>
    new Intl.NumberFormat().format(n);

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

  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-2xl font-bold text-foreground">
          {t("aiUsage.title")}
        </h2>
        <p className="text-sm text-muted-foreground mt-1">
          {t("aiUsage.subtitle")}
        </p>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
        <SummaryCard
          icon={<Zap className="w-5 h-5 text-teal-600" />}
          label={t("aiUsage.totalRequests")}
          value={formatNumber(totals.requests)}
        />
        <SummaryCard
          icon={<Activity className="w-5 h-5 text-blue-600" />}
          label={t("aiUsage.totalTokens")}
          value={formatNumber(totals.tokens)}
        />
        <SummaryCard
          icon={<Coins className="w-5 h-5 text-amber-600" />}
          label={t("aiUsage.totalCost")}
          value={formatCost(totals.cost)}
        />
        <SummaryCard
          icon={<Users className="w-5 h-5 text-purple-600" />}
          label={t("aiUsage.activeTenants")}
          value={String(activeTenants)}
        />
      </div>

      {/* Tenants table */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">{t("aiUsage.thisMonth")}</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {tenants && tenants.length > 0 ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t("aiUsage.tenant")}</TableHead>
                  <TableHead className="text-right">
                    {t("aiUsage.requests")}
                  </TableHead>
                  <TableHead className="text-right">
                    {t("aiUsage.tokens")}
                  </TableHead>
                  <TableHead className="text-right">
                    {t("aiUsage.cost")}
                  </TableHead>
                  <TableHead className="text-right">
                    {t("aiUsage.quotaUsed")}
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {tenants.map((tenant) => (
                  <TableRow key={tenant.tenant_id}>
                    <TableCell>
                      <Link
                        to="/admin/ai-usage/$tenantId"
                        params={{ tenantId: tenant.tenant_id }}
                        className="font-medium text-foreground hover:underline"
                      >
                        {tenant.tenant_name}
                      </Link>
                    </TableCell>
                    <TableCell className="text-right">
                      {formatNumber(tenant.total_requests)}
                    </TableCell>
                    <TableCell className="text-right">
                      {formatNumber(tenant.total_tokens)}
                    </TableCell>
                    <TableCell className="text-right">
                      {formatCost(tenant.total_cost_usd)}
                    </TableCell>
                    <TableCell className="text-right">
                      {tenant.quota_pct != null ? (
                        <Badge
                          variant={
                            tenant.quota_pct >= 95
                              ? "destructive"
                              : tenant.quota_pct >= 80
                                ? "secondary"
                                : "outline"
                          }
                        >
                          {tenant.quota_pct.toFixed(0)}%
                        </Badge>
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          ) : (
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <Activity className="w-10 h-10 text-muted-foreground mb-4" />
              <p className="text-lg font-medium">{t("aiUsage.noUsage")}</p>
              <p className="text-sm text-muted-foreground mt-1">
                {t("aiUsage.noUsageHint")}
              </p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function SummaryCard({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
}) {
  return (
    <Card>
      <CardContent className="p-6">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-muted">{icon}</div>
          <div>
            <p className="text-sm text-muted-foreground">{label}</p>
            <p className="text-2xl font-bold">{value}</p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
