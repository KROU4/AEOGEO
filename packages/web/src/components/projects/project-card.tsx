import { Globe, Users } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { formatVisibilityScore } from "@/lib/report";

interface ProjectCardProps {
  name: string;
  clientName: string;
  domain: string | null;
  memberCount: number;
  visibilityScore: number | null;
}

export function ProjectCard({
  name,
  clientName,
  domain,
  memberCount,
  visibilityScore,
}: ProjectCardProps) {
  const initial = clientName.charAt(0).toUpperCase();

  return (
    <Card className="transition-shadow hover:shadow-md">
      <CardContent className="space-y-3 pt-5">
        <div className="flex items-center justify-between">
          <Avatar size="lg">
            <AvatarFallback className="bg-teal-50 text-teal-700 font-bold">
              {initial}
            </AvatarFallback>
          </Avatar>
          {visibilityScore !== null && (
            <Badge
              variant="outline"
              className="bg-teal-50 text-teal-700 border-teal-200"
            >
              {formatVisibilityScore(visibilityScore)}/10
            </Badge>
          )}
        </div>
        <h3 className="text-base font-semibold text-foreground">{name}</h3>
        {domain && (
          <div className="flex items-center gap-1.5">
            <Globe className="h-4 w-4 text-muted-foreground" />
            <span className="text-sm text-muted-foreground">{domain}</span>
          </div>
        )}
        <div className="flex items-center gap-1.5">
          <Users className="h-4 w-4 text-muted-foreground" />
          <span className="text-sm text-muted-foreground">
            {memberCount} members
          </span>
        </div>
        <Button variant="outline" className="w-full">
          View Project
        </Button>
      </CardContent>
    </Card>
  );
}
