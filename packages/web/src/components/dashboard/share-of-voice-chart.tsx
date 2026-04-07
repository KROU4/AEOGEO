import { PieChart } from "lucide-react";
import {
  Card,
  CardHeader,
  CardContent,
} from "@/components/ui/card";

export function ShareOfVoiceChart() {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center gap-2 space-y-0 pb-2">
        <PieChart className="h-4 w-4 text-teal-600" />
        <span className="text-sm text-muted-foreground">Share of Voice</span>
      </CardHeader>
      <CardContent>
        <div className="mb-1">
          <span className="text-3xl font-bold text-foreground">34%</span>
        </div>
        <p className="text-xs text-green-600 mb-3">+2.1% vs last 30d</p>
        <div className="space-y-1 text-xs text-muted-foreground">
          <div className="flex items-center justify-between">
            <span>ChatGPT</span>
            <span className="font-medium text-foreground">34%</span>
          </div>
          <div className="flex items-center justify-between">
            <span>Gemini</span>
            <span className="font-medium text-foreground">22%</span>
          </div>
          <div className="flex items-center justify-between">
            <span>Perplexity</span>
            <span className="font-medium text-foreground">19%</span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
