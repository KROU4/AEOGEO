import { Share2 } from "lucide-react";
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";

interface ReportCardProps {
  title: string;
  type: string;
  date: string;
  metrics: { label: string; value: string }[];
}

const typeConfig: Record<
  string,
  { label: string; className: string }
> = {
  visibility_audit: {
    label: "Visibility Audit",
    className: "bg-purple-50 text-purple-700 border-purple-200 hover:bg-purple-100",
  },
  competitive_analysis: {
    label: "Competitive Analysis",
    className: "bg-teal-50 text-teal-700 border-teal-200 hover:bg-teal-100",
  },
  content_performance: {
    label: "Content Performance",
    className: "bg-green-50 text-green-700 border-green-200 hover:bg-green-100",
  },
};

export function ReportCard({ title, type, date, metrics }: ReportCardProps) {
  const config = typeConfig[type] ?? {
    label: type,
    className: "",
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <Badge variant="outline" className={config.className}>
            {config.label}
          </Badge>
          <span className="text-xs text-muted-foreground">{date}</span>
        </div>
        <CardTitle className="text-base">{title}</CardTitle>
        <CardDescription>
          {metrics.length} metric{metrics.length !== 1 ? "s" : ""} tracked
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="flex flex-wrap gap-x-4 gap-y-1 mb-4">
          {metrics.map((m, i) => (
            <span key={i} className="text-xs text-muted-foreground">
              {m.label}:{" "}
              <span className="font-medium text-foreground">{m.value}</span>
            </span>
          ))}
        </div>
        <Separator className="mb-4" />
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm">
            View
          </Button>
          <Button variant="ghost" size="sm">
            <Share2 className="mr-1 h-4 w-4" />
            Share
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
