import type { LucideIcon } from "lucide-react";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";

interface PlaceholderCardProps {
  title: string;
  description?: string;
  icon?: LucideIcon;
  className?: string;
}

export function PlaceholderCard({
  title,
  description,
  icon: Icon,
  className,
}: PlaceholderCardProps) {
  return (
    <Card
      className={cn(
        "border-dashed border-muted flex items-center justify-center p-10",
        className,
      )}
    >
      <div className="text-center">
        {Icon && (
          <Icon className="w-12 h-12 text-muted-foreground mx-auto" />
        )}
        <p className="text-sm font-medium text-muted-foreground mt-3">
          {title}
        </p>
        {description && (
          <p className="text-xs text-muted-foreground/70 mt-1">
            {description}
          </p>
        )}
      </div>
    </Card>
  );
}
