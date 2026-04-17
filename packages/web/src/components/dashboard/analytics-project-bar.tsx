import { useTranslation } from "react-i18next";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { useExplorerProjectId } from "@/hooks/use-explorer-project";

export function AnalyticsProjectBar() {
  const { t } = useTranslation("dashboard");
  const { projectId, projects, isLoadingProjects, setPreferredProjectId } = useExplorerProjectId();

  if (isLoadingProjects) {
    return <Skeleton className="h-9 w-full max-w-md mb-6" />;
  }

  if (projects.length === 0) {
    return null;
  }

  return (
    <div className="flex flex-wrap items-center gap-3 mb-6">
      <span className="text-sm text-muted-foreground">{t("analyticsProject.label")}</span>
      <Select
        value={projectId ?? ""}
        onValueChange={(v) => setPreferredProjectId(v)}
      >
        <SelectTrigger className="w-[min(100%,280px)]">
          <SelectValue placeholder={t("analyticsProject.placeholder")} />
        </SelectTrigger>
        <SelectContent>
          {projects.map((p) => (
            <SelectItem key={p.id} value={p.id}>
              {p.name}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}

export function AnalyticsEmptyState() {
  const { t } = useTranslation("dashboard");
  return (
    <div className="rounded-sm border border-border bg-card p-8 text-center text-sm text-muted-foreground">
      {t("analyticsProject.empty")}
    </div>
  );
}
