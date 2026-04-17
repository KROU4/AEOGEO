import { useEffect, useState } from "react";
import { CheckCircle2, Loader2 } from "lucide-react";
import { useTranslation } from "react-i18next";

interface AnalysisProgressProps {
  /** Called when the 7-second animation finishes. */
  onComplete: () => void;
  projectName?: string;
}

const STEPS = [
  "analysisProgress.step1",
  "analysisProgress.step2",
  "analysisProgress.step3",
  "analysisProgress.step4",
  "analysisProgress.step5",
] as const;

const STEP_DURATION_MS = 1400;
const TOTAL_DURATION_MS = STEPS.length * STEP_DURATION_MS;

export function AnalysisProgress({ onComplete, projectName }: AnalysisProgressProps) {
  const { t } = useTranslation("projects");
  const [currentStep, setCurrentStep] = useState(0);
  const [completedSteps, setCompletedSteps] = useState<number[]>([]);
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    const stepTimers: ReturnType<typeof setTimeout>[] = [];

    STEPS.forEach((_, idx) => {
      stepTimers.push(
        setTimeout(() => {
          setCurrentStep(idx);
          if (idx > 0) {
            setCompletedSteps((prev) => [...prev, idx - 1]);
          }
          setProgress(Math.round(((idx + 1) / STEPS.length) * 90));
        }, idx * STEP_DURATION_MS),
      );
    });

    const completeTimer = setTimeout(() => {
      setCompletedSteps(STEPS.map((_, i) => i));
      setProgress(100);
      setTimeout(onComplete, 400);
    }, TOTAL_DURATION_MS);

    return () => {
      stepTimers.forEach(clearTimeout);
      clearTimeout(completeTimer);
    };
  }, [onComplete]);

  return (
    <div className="mx-auto max-w-lg space-y-8 py-8">
      {/* Header */}
      <div className="space-y-1">
        <h2 className="text-2xl font-bold text-foreground">
          {t("analysisProgress.title")}
        </h2>
        {projectName && (
          <p className="text-sm text-muted-foreground">
            {t("analysisProgress.subtitle", { name: projectName })}
          </p>
        )}
      </div>

      {/* Progress bar */}
      <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
        <div
          className="h-full rounded-full bg-primary transition-all duration-700 ease-out"
          style={{ width: `${progress}%` }}
        />
      </div>

      {/* Steps */}
      <div className="space-y-3">
        {STEPS.map((key, idx) => {
          const isDone = completedSteps.includes(idx);
          const isActive = currentStep === idx && !isDone;
          return (
            <div
              key={key}
              className={[
                "flex items-center gap-3 rounded-lg border px-4 py-3 text-sm transition-all duration-500",
                isDone
                  ? "border-green-200 bg-green-50 text-green-800 dark:border-green-900 dark:bg-green-950/40 dark:text-green-300"
                  : isActive
                    ? "border-primary/30 bg-primary/5 text-foreground shadow-sm"
                    : "border-border/40 bg-muted/30 text-muted-foreground",
              ].join(" ")}
            >
              {isDone ? (
                <CheckCircle2 className="h-4 w-4 shrink-0 text-green-600 dark:text-green-400" />
              ) : isActive ? (
                <Loader2 className="h-4 w-4 shrink-0 animate-spin text-primary" />
              ) : (
                <span className="h-4 w-4 shrink-0 rounded-full border-2 border-border/50" />
              )}
              <span className="font-medium">{t(key as never)}</span>
            </div>
          );
        })}
      </div>

      <p className="text-center text-xs text-muted-foreground">
        {t("analysisProgress.hint")}
      </p>
    </div>
  );
}
