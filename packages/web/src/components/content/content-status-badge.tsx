import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { useTranslation } from "react-i18next";

interface ContentStatusBadgeProps {
  status: string;
}

const statusConfig: Record<
  string,
  { variant: "secondary" | "outline"; className?: string }
> = {
  draft: { variant: "secondary" },
  review: {
    variant: "outline",
    className: "bg-amber-50 text-amber-700 border-amber-200 hover:bg-amber-100",
  },
  published: {
    variant: "outline",
    className: "bg-green-50 text-green-700 border-green-200 hover:bg-green-100",
  },
  archived: {
    variant: "outline",
    className: "text-muted-foreground",
  },
};

export function ContentStatusBadge({ status }: ContentStatusBadgeProps) {
  const { t } = useTranslation("common");
  const config = statusConfig[status] ?? statusConfig["draft"]!;

  return (
    <Badge variant={config.variant} className={cn(config.className)}>
      {t(`status.${status}`, { defaultValue: status })}
    </Badge>
  );
}
