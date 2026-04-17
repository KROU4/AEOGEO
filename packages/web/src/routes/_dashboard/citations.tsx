import { useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer } from "recharts";
import { AnalyticsEmptyState, AnalyticsProjectBar } from "@/components/dashboard/analytics-project-bar";
import { useExplorerProjectId } from "@/hooks/use-explorer-project";
import { useProjectCitations } from "@/hooks/use-project-explorer";
import { useEngines } from "@/hooks/use-engines";
import { Skeleton } from "@/components/ui/skeleton";

export const Route = createFileRoute("/_dashboard/citations")({
  component: CitationsPage,
});

const TOOLTIP_STYLE = { background: "#1b1c1d", border: "none", borderRadius: 4, fontSize: 12 };

const PIE_COLORS = ["#4cd7f6", "#4ae176", "#a78bfa", "#fb923c", "#f472b6", "#94a3b8"];

function CitationsPage() {
  const { t } = useTranslation("dashboard");
  const { projectId } = useExplorerProjectId();
  const [search, setSearch] = useState("");
  const [platform, setPlatform] = useState("all");

  const list = useProjectCitations(projectId ?? undefined, {
    engine: platform,
    limit: 100,
    page: 1,
  });
  const enginesQ = useEngines();

  const filtered = useMemo(() => {
    const rows = list.data?.citations ?? [];
    const q = search.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter(
      (c) =>
        c.domain.toLowerCase().includes(q) ||
        (c.query_preview ?? "").toLowerCase().includes(q),
    );
  }, [list.data?.citations, search]);

  const stats = useMemo(() => {
    const rows = list.data?.citations ?? [];
    const byEngine: Record<string, number> = {};
    for (const c of rows) {
      byEngine[c.engine] = (byEngine[c.engine] ?? 0) + c.times_cited;
    }
    const entries = Object.entries(byEngine);
    entries.sort((a, b) => b[1] - a[1]);
    const top = entries[0];
    const total = list.data?.total ?? 0;
    return {
      total,
      topName: top?.[0] ?? "—",
      pie: entries.map(([name, value], i) => ({
        name,
        value,
        fill: PIE_COLORS[i % PIE_COLORS.length],
      })),
    };
  }, [list.data?.citations, list.data?.total]);

  if (!projectId) {
    return (
      <div className="space-y-6">
        <AnalyticsProjectBar />
        <AnalyticsEmptyState />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <AnalyticsProjectBar />

      <div className="grid grid-cols-3 gap-4">
        <Card>
          <CardContent className="pt-6">
            <p className="text-xs text-muted-foreground uppercase tracking-wider">{t("stitch.citations.statTotal")}</p>
            {list.isLoading ? (
              <Skeleton className="h-9 w-16 mt-2" />
            ) : (
              <p className="text-3xl font-bold font-avop-mono mt-2 text-foreground">{stats.total}</p>
            )}
            <p className="text-xs text-muted-foreground mt-1">{t("stitch.citations.statTotalHint")}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <p className="text-xs text-muted-foreground uppercase tracking-wider">{t("stitch.citations.statTop")}</p>
            {list.isLoading ? (
              <Skeleton className="h-8 w-32 mt-2" />
            ) : (
              <p className="text-xl font-semibold mt-2 text-primary">{stats.topName}</p>
            )}
            <p className="text-xs text-muted-foreground mt-1">{t("stitch.citations.statTopHint")}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <p className="text-xs text-muted-foreground uppercase tracking-wider">{t("stitch.citations.statFiltered")}</p>
            {list.isLoading ? (
              <Skeleton className="h-9 w-16 mt-2" />
            ) : (
              <p className="text-3xl font-bold font-avop-mono mt-2 text-foreground">{filtered.length}</p>
            )}
            <p className="text-xs text-muted-foreground mt-1">{t("stitch.citations.statFilteredHint")}</p>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-3 gap-6">
        <div className="col-span-2 space-y-3">
          <div className="flex gap-3 flex-wrap">
            <Input
              placeholder={t("stitch.citations.searchPlaceholder")}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="max-w-xs"
            />
            <Select value={platform} onValueChange={setPlatform}>
              <SelectTrigger className="w-[200px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{t("stitch.citations.allEngines")}</SelectItem>
                {(enginesQ.data ?? []).map((e) => (
                  <SelectItem key={e.id} value={e.slug}>
                    {e.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {list.isLoading ? (
            <Skeleton className="h-48 w-full" />
          ) : filtered.length === 0 ? (
            <p className="text-sm text-muted-foreground py-8 text-center">{t("stitch.citations.noMatch")}</p>
          ) : (
            filtered.map((c, i) => (
              <Card key={`${c.domain}-${i}`}>
                <CardContent className="pt-4 pb-4">
                  <div className="flex items-start justify-between gap-4">
                    <div className="min-w-0 flex-1">
                      <p className="text-xs text-primary font-medium truncate">{c.domain}</p>
                      <p className="text-xs text-muted-foreground mt-1.5 leading-relaxed">
                        {c.query_preview ? `“${c.query_preview}”` : "—"}
                      </p>
                    </div>
                    <div className="flex flex-col items-end gap-1.5 shrink-0">
                      <span className="text-xs px-2 py-0.5 rounded-sm bg-accent text-accent-foreground">{c.engine}</span>
                      <span className="text-[10px] text-muted-foreground">
                        {c.times_cited} {t("stitch.citations.citesSuffix")}
                      </span>
                      {c.is_client_domain ? (
                        <span className="text-xs font-medium text-[#4ae176]">{t("stitch.citations.yourDomain")}</span>
                      ) : null}
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))
          )}
        </div>

        <Card>
          <CardHeader>
            <CardTitle style={{ fontFamily: "var(--font-avop-heading)" }}>{t("stitch.citations.pieTitle")}</CardTitle>
          </CardHeader>
          <CardContent>
            {list.isLoading ? (
              <Skeleton className="h-[180px] w-full" />
            ) : stats.pie.length === 0 ? (
              <p className="text-sm text-muted-foreground">{t("stitch.citations.pieEmpty")}</p>
            ) : (
              <>
                <ResponsiveContainer width="100%" height={180}>
                  <PieChart>
                    <Pie
                      data={stats.pie}
                      dataKey="value"
                      cx="50%"
                      cy="50%"
                      innerRadius={45}
                      outerRadius={72}
                      paddingAngle={2}
                    >
                      {stats.pie.map((entry, i) => (
                        <Cell key={entry.name} fill={entry.fill} />
                      ))}
                    </Pie>
                    <Tooltip contentStyle={TOOLTIP_STYLE} formatter={(v) => [v, t("stitch.visibility.colCites")]} />
                  </PieChart>
                </ResponsiveContainer>
                <div className="space-y-2 mt-3">
                  {stats.pie.map((p) => (
                    <div key={p.name} className="flex items-center justify-between text-xs">
                      <div className="flex items-center gap-2">
                        <span className="w-2 h-2 rounded-full shrink-0" style={{ background: p.fill }} />
                        <span className="text-muted-foreground">{p.name}</span>
                      </div>
                      <span className="font-avop-mono text-foreground">{p.value}</span>
                    </div>
                  ))}
                </div>
              </>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
