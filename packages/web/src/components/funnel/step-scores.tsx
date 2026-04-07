import { useTranslation } from "react-i18next";
import { ArrowLeft, TrendingUp } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { useScoreSummary, useScoresByEngine } from "@/hooks/use-visibility";

interface StepScoresProps {
  projectId: string;
  onContinue: () => void;
  onBack: () => void;
}

function ScoreRing({ value, size = 120 }: { value: number; size?: number }) {
  const radius = (size - 12) / 2;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (value / 100) * circumference;
  const color = value >= 60 ? "text-primary" : value >= 30 ? "text-amber-500" : "text-red-500";

  return (
    <div className="relative inline-flex items-center justify-center" style={{ width: size, height: size }}>
      <svg className="-rotate-90" width={size} height={size}>
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="currentColor"
          strokeWidth={6}
          className="text-muted/30"
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="currentColor"
          strokeWidth={6}
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          strokeLinecap="round"
          className={color}
        />
      </svg>
      <div className="absolute flex flex-col items-center">
        <span className="text-3xl font-bold">{Math.round(value)}</span>
        <span className="text-xs text-muted-foreground">/100</span>
      </div>
    </div>
  );
}

export function StepScores({ projectId, onContinue, onBack }: StepScoresProps) {
  const { t } = useTranslation("funnel");
  const { data: summary, isLoading: summaryLoading } = useScoreSummary(projectId);
  const { data: engineScores } = useScoresByEngine(projectId);

  const metrics = [
    { key: "mention", value: summary?.mention_score ?? 0 },
    { key: "sentiment", value: summary?.sentiment_score ?? 0 },
    { key: "position", value: summary?.position_score ?? 0 },
    { key: "accuracy", value: summary?.accuracy_score ?? 0 },
    { key: "citation", value: summary?.citation_score ?? 0 },
    { key: "recommendation", value: summary?.recommendation_score ?? 0 },
  ];

  return (
    <div className="w-full space-y-8 text-center">
      <div>
        <h1 className="text-2xl font-bold">{t("scores.heading")}</h1>
        <p className="mt-2 text-muted-foreground">{t("scores.description")}</p>
      </div>

      {summaryLoading ? (
        <div className="text-sm text-muted-foreground">Loading scores...</div>
      ) : (
        <div className="space-y-6">
          {/* Overall score */}
          <div className="flex flex-col items-center gap-2">
            <ScoreRing value={summary?.total_score ?? 0} />
            <span className="text-sm font-medium text-muted-foreground">
              {t("scores.overallScore")}
            </span>
          </div>

          {/* Metric breakdown */}
          <div className="mx-auto grid max-w-lg grid-cols-3 gap-3">
            {metrics.map(({ key, value }) => (
              <Card key={key} className="text-center">
                <CardContent className="p-3">
                  <div className="text-lg font-bold">{Math.round(value)}</div>
                  <div className="text-xs text-muted-foreground">
                    {t(`scores.${key}`)}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>

          {/* Per engine */}
          {engineScores && engineScores.length > 0 && (
            <div className="mx-auto max-w-lg">
              <h3 className="mb-3 text-sm font-medium text-muted-foreground">
                {t("scores.perEngine")}
              </h3>
              <div className="space-y-2">
                {engineScores.map((engine) => (
                  <div
                    key={engine.engine_id}
                    className="flex items-center justify-between rounded-lg border p-3"
                  >
                    <span className="text-sm font-medium">{engine.engine}</span>
                    <div className="flex items-center gap-1">
                      <TrendingUp className="h-3.5 w-3.5 text-muted-foreground" />
                      <span className="text-sm font-bold">
                        {Math.round(engine.total_score)}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      <div className="flex items-center justify-center gap-3">
        <Button variant="outline" onClick={onBack}>
          <ArrowLeft className="mr-2 h-4 w-4" />
          {t("navigation.back")}
        </Button>
        <Button size="lg" onClick={onContinue} disabled={summaryLoading}>
          {t("navigation.continue")}
        </Button>
      </div>
    </div>
  );
}
