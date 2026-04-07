import { ThumbsUp } from "lucide-react";
import {
  Card,
  CardHeader,
  CardContent,
} from "@/components/ui/card";

export function SentimentGauge() {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center gap-2 space-y-0 pb-2">
        <ThumbsUp className="h-4 w-4 text-green-600" />
        <span className="text-sm text-muted-foreground">Sentiment</span>
      </CardHeader>
      <CardContent>
        <div className="mb-3">
          <span className="text-3xl font-bold text-foreground">68%</span>
          <span className="ml-1 text-sm text-muted-foreground">positive</span>
        </div>
        <div className="flex items-center gap-4 text-xs">
          <span className="text-muted-foreground">
            <span className="inline-block h-2 w-2 rounded-full bg-amber-400 mr-1.5" />
            22% neutral
          </span>
          <span className="text-muted-foreground">
            <span className="inline-block h-2 w-2 rounded-full bg-red-400 mr-1.5" />
            10% negative
          </span>
        </div>
      </CardContent>
    </Card>
  );
}
