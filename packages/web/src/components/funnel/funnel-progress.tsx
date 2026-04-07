import { useTranslation } from "react-i18next";
import { cn } from "@/lib/utils";
import { Check } from "lucide-react";

const STEP_KEYS = [
  "steps.createProject",
  "steps.crawl",
  "steps.knowledge",
  "steps.keywords",
  "steps.questions",
  "steps.runEngines",
  "steps.scores",
  "steps.recommendations",
] as const;

interface FunnelProgressProps {
  currentStep: number;
  totalSteps: number;
}

export function FunnelProgress({ currentStep, totalSteps }: FunnelProgressProps) {
  const { t } = useTranslation("funnel");

  return (
    <div className="flex items-center justify-center gap-0">
      {Array.from({ length: totalSteps }, (_, i) => {
        const step = i + 1;
        const isCompleted = step < currentStep;
        const isCurrent = step === currentStep;

        return (
          <div key={step} className="flex items-center">
            {/* Dot */}
            <div className="flex flex-col items-center">
              <div
                className={cn(
                  "flex h-8 w-8 items-center justify-center rounded-full text-xs font-medium transition-all",
                  isCompleted && "bg-primary text-primary-foreground",
                  isCurrent && "border-2 border-primary bg-primary/10 text-primary",
                  !isCompleted && !isCurrent && "border border-muted-foreground/30 text-muted-foreground/50",
                )}
              >
                {isCompleted ? <Check className="h-4 w-4" /> : step}
              </div>
              {/* Label — only show for current step on desktop */}
              {isCurrent && (
                <span className="mt-1 hidden text-xs font-medium text-primary md:block">
                  {t(STEP_KEYS[i] ?? "")}
                </span>
              )}
            </div>

            {/* Connector line */}
            {step < totalSteps && (
              <div
                className={cn(
                  "mx-1 h-0.5 w-6 transition-colors md:w-10",
                  step < currentStep ? "bg-primary" : "bg-muted-foreground/20",
                )}
              />
            )}
          </div>
        );
      })}
    </div>
  );
}
