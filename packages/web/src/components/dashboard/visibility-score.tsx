import { Eye, ArrowUp } from "lucide-react";
import {
  Card,
  CardHeader,
  CardContent,
} from "@/components/ui/card";

export function VisibilityScoreCard() {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center gap-2 space-y-0 pb-2">
        <Eye className="h-4 w-4 text-teal-600" />
        <span className="text-sm text-muted-foreground">
          AI Visibility Score
        </span>
      </CardHeader>
      <CardContent>
        <div className="mb-2">
          <span className="text-3xl font-bold text-foreground">7.2</span>
          <span className="text-sm text-muted-foreground">/10</span>
        </div>
        <div className="flex items-center gap-1">
          <ArrowUp className="h-3 w-3 text-green-600" />
          <span className="text-xs text-green-600">+5</span>
          <span className="text-xs text-muted-foreground">vs last 30d</span>
        </div>
      </CardContent>
    </Card>
  );
}
