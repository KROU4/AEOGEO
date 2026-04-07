import { useTranslation } from "react-i18next";
import { Check } from "lucide-react";
import { cn } from "@/lib/utils";

export interface WizardStep {
  key: string;
  labelKey: string;
  descriptionKey: string;
}

const STEPS: WizardStep[] = [
  {
    key: "brand-basics",
    labelKey: "steps.brandBasics",
    descriptionKey: "stepDescriptions.brandBasics",
  },
  {
    key: "crawl-website",
    labelKey: "steps.crawlWebsite",
    descriptionKey: "stepDescriptions.crawlWebsite",
  },
  {
    key: "products",
    labelKey: "steps.products",
    descriptionKey: "stepDescriptions.products",
  },
  {
    key: "competitors",
    labelKey: "steps.competitors",
    descriptionKey: "stepDescriptions.competitors",
  },
  {
    key: "upload-files",
    labelKey: "steps.uploadFiles",
    descriptionKey: "stepDescriptions.uploadFiles",
  },
  {
    key: "review-questions",
    labelKey: "steps.reviewQuestions",
    descriptionKey: "stepDescriptions.reviewQuestions",
  },
  {
    key: "review",
    labelKey: "steps.review",
    descriptionKey: "stepDescriptions.review",
  },
];

interface WizardStepperProps {
  currentStep: number;
  onStepClick?: (step: number) => void;
}

export function WizardStepper({ currentStep, onStepClick }: WizardStepperProps) {
  const { t } = useTranslation("onboarding");

  return (
    <nav aria-label="Progress" className="w-full">
      <ol className="flex items-center gap-2">
        {STEPS.map((step, index) => {
          const stepNumber = index + 1;
          const isCompleted = stepNumber < currentStep;
          const isCurrent = stepNumber === currentStep;
          const isClickable = onStepClick && stepNumber <= currentStep;

          return (
            <li key={step.key} className="flex items-center flex-1 last:flex-none">
              <button
                type="button"
                onClick={() => isClickable && onStepClick(stepNumber)}
                disabled={!isClickable}
                className={cn(
                  "group flex items-center gap-2 text-left transition-colors",
                  isClickable && "cursor-pointer",
                  !isClickable && "cursor-default"
                )}
              >
                {/* Step circle */}
                <div
                  className={cn(
                    "flex h-8 w-8 shrink-0 items-center justify-center rounded-full border-2 text-sm font-semibold transition-all",
                    isCompleted &&
                      "border-teal-600 bg-teal-600 text-white",
                    isCurrent &&
                      "border-teal-600 bg-teal-50 text-teal-700 dark:bg-teal-950 dark:text-teal-300",
                    !isCompleted &&
                      !isCurrent &&
                      "border-muted-foreground/30 text-muted-foreground/50"
                  )}
                >
                  {isCompleted ? (
                    <Check className="h-4 w-4" />
                  ) : (
                    stepNumber
                  )}
                </div>

                {/* Label — hidden on small screens for non-current steps */}
                <span
                  className={cn(
                    "text-sm font-medium hidden lg:inline whitespace-nowrap",
                    isCurrent && "text-foreground",
                    isCompleted && "text-teal-700 dark:text-teal-400",
                    !isCompleted && !isCurrent && "text-muted-foreground/50"
                  )}
                >
                  {t(step.labelKey)}
                </span>
              </button>

              {/* Connector line */}
              {index < STEPS.length - 1 && (
                <div
                  className={cn(
                    "mx-2 h-0.5 flex-1 rounded-full transition-colors",
                    stepNumber < currentStep
                      ? "bg-teal-600"
                      : "bg-muted-foreground/20"
                  )}
                />
              )}
            </li>
          );
        })}
      </ol>

      {/* Mobile: show current step description */}
      <p className="mt-3 text-sm text-muted-foreground lg:hidden">
        {t("navigation.stepOf", {
          current: currentStep,
          total: STEPS.length,
        })}{" "}
        — {t(STEPS[currentStep - 1]?.descriptionKey ?? "")}
      </p>
    </nav>
  );
}

export { STEPS };
export const TOTAL_STEPS = STEPS.length;
