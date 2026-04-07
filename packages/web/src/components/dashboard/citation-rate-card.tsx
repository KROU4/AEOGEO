import { Link2 } from "lucide-react";
import {
  Card,
  CardHeader,
  CardContent,
} from "@/components/ui/card";

export function CitationRateCard() {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center gap-2 space-y-0 pb-2">
        <Link2 className="h-4 w-4 text-teal-600" />
        <span className="text-sm text-muted-foreground">Citation Rate</span>
      </CardHeader>
      <CardContent>
        <div className="mb-2">
          <span className="text-3xl font-bold text-foreground">156</span>
          <span className="ml-1 text-sm text-muted-foreground">citations</span>
        </div>
        <p className="text-xs text-green-600">+12 vs last 30d</p>
      </CardContent>
    </Card>
  );
}
