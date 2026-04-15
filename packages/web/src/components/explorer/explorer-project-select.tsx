import { useTranslation } from "react-i18next";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { Project } from "@/types/project";

interface ExplorerProjectSelectProps {
  projects: Project[];
  value: string | null;
  onChange: (projectId: string) => void;
  disabled?: boolean;
}

export function ExplorerProjectSelect({
  projects,
  value,
  onChange,
  disabled,
}: ExplorerProjectSelectProps) {
  const { t } = useTranslation("explorer");

  return (
    <div className="flex flex-wrap items-center gap-3">
      <span className="text-sm font-medium text-foreground">
        {t("projectLabel")}
      </span>
      <Select
        value={value ?? "__none__"}
        onValueChange={(v) => {
          if (v !== "__none__") onChange(v);
        }}
        disabled={disabled}
      >
        <SelectTrigger className="w-[min(100%,280px)]">
          <SelectValue placeholder={t("projectPlaceholder")} />
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
