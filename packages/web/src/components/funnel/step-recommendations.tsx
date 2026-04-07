import { useEffect, useRef } from "react";
import { useTranslation } from "react-i18next";
import {
  Loader2,
  ArrowLeft,
  ArrowRight,
  Lightbulb,
  FileText,
  Search,
  Target,
  Wrench,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  useRecommendations,
  useGenerateRecommendations,
} from "@/hooks/use-recommendations";

interface StepRecommendationsProps {
  projectId: string;
  onFinish: () => void;
  onBack: () => void;
}

const categoryIcons: Record<string, typeof Lightbulb> = {
  content: FileText,
  seo: Search,
  brand_positioning: Target,
  technical: Wrench,
};

const priorityColors: Record<string, string> = {
  high: "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200",
  medium: "bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-200",
  low: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200",
};

export function StepRecommendations({
  projectId,
  onFinish,
  onBack,
}: StepRecommendationsProps) {
  const { t } = useTranslation("funnel");
  const { data: recommendations, refetch } = useRecommendations(projectId);
  const generate = useGenerateRecommendations(projectId);
  const started = useRef(false);

  useEffect(() => {
    if (started.current || (recommendations && recommendations.length > 0)) return;
    started.current = true;

    generate.mutate(
      {},
      {
        onSuccess: () => refetch(),
        onError: () => toast.error("Failed to generate recommendations"),
      },
    );
  }, [recommendations]);

  return (
    <div className="w-full space-y-8 text-center">
      <div>
        <h1 className="text-2xl font-bold">{t("recommendations.heading")}</h1>
        <p className="mt-2 text-muted-foreground">{t("recommendations.description")}</p>
      </div>

      {generate.isPending ? (
        <div className="flex items-center justify-center gap-2 text-muted-foreground">
          <Loader2 className="h-5 w-5 animate-spin" />
          <span>{t("recommendations.generating")}</span>
        </div>
      ) : (
        <div className="mx-auto max-w-lg space-y-3">
          {recommendations?.map((rec) => {
            const Icon = categoryIcons[rec.category] || Lightbulb;
            return (
              <Card key={rec.id} className="text-left">
                <CardHeader className="flex flex-row items-start gap-3 pb-2">
                  <Icon className="mt-0.5 h-5 w-5 shrink-0 text-muted-foreground" />
                  <div className="flex-1 space-y-1">
                    <div className="flex items-start justify-between gap-2">
                      <CardTitle className="text-sm font-semibold leading-tight">
                        {rec.title}
                      </CardTitle>
                      <Badge
                        variant="secondary"
                        className={`shrink-0 text-xs ${priorityColors[rec.priority] || ""}`}
                      >
                        {t(`recommendations.priorities.${rec.priority}`)}
                      </Badge>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="pl-11 pt-0">
                  <p className="text-sm text-muted-foreground">{rec.description}</p>
                  {rec.affected_keywords && rec.affected_keywords.length > 0 && (
                    <div className="mt-2 flex flex-wrap gap-1">
                      {rec.affected_keywords.map((kw) => (
                        <Badge
                          key={kw}
                          variant="outline"
                          className="text-xs font-normal"
                        >
                          {kw}
                        </Badge>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      <div className="flex items-center justify-center gap-3">
        <Button variant="outline" onClick={onBack}>
          <ArrowLeft className="mr-2 h-4 w-4" />
          {t("navigation.back")}
        </Button>
        <Button size="lg" onClick={onFinish}>
          <ArrowRight className="mr-2 h-4 w-4" />
          {t("recommendations.goToDashboard")}
        </Button>
      </div>
    </div>
  );
}
