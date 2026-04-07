import {
  Card,
  CardHeader,
  CardTitle,
  CardContent,
} from "@/components/ui/card";
import { cn } from "@/lib/utils";

const activities = [
  {
    color: "bg-green-500",
    description: 'Content "Q4 FAQ" published',
    time: "2h ago",
  },
  {
    color: "bg-teal-500",
    description: "Report generated for Acme Corp",
    time: "5h ago",
  },
  {
    color: "bg-purple-500",
    description: "Engine Perplexity added to project",
    time: "1d ago",
  },
  {
    color: "bg-amber-500",
    description: "Invite sent to john@acme.com",
    time: "1d ago",
  },
  {
    color: "bg-cyan-500",
    description: "Visibility score increased +5",
    time: "2d ago",
  },
];

export function RecentActivity() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Recent Activity</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="divide-y">
          {activities.map((item, i) => (
            <div
              key={i}
              className="flex items-center justify-between py-3 first:pt-0 last:pb-0"
            >
              <div className="flex items-center gap-3">
                <span
                  className={cn("h-2 w-2 shrink-0 rounded-full", item.color)}
                />
                <span className="text-sm text-foreground">
                  {item.description}
                </span>
              </div>
              <span className="ml-4 whitespace-nowrap text-xs text-muted-foreground">
                {item.time}
              </span>
            </div>
          ))}
        </div>
        <div className="mt-4 text-center">
          <a
            href="#"
            className="text-xs font-medium text-primary hover:underline"
          >
            View all activity
          </a>
        </div>
      </CardContent>
    </Card>
  );
}
