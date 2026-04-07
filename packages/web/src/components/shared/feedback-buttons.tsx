import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
  TooltipProvider,
} from "@/components/ui/tooltip";
import { ThumbsUp, ThumbsDown } from "lucide-react";
import {
  useClearFeedback,
  useMyFeedback,
  useSubmitFeedback,
} from "@/hooks/use-feedback";
import { useTranslation } from "react-i18next";
import { cn } from "@/lib/utils";
import type { FeedbackEntityType, FeedbackType } from "@/types/widget";

interface FeedbackButtonsProps {
  entityType: FeedbackEntityType;
  entityId: string;
  initialFeedback?: FeedbackType | null;
  size?: "sm" | "default";
}

export function FeedbackButtons({
  entityType,
  entityId,
  initialFeedback = null,
  size = "default",
}: FeedbackButtonsProps) {
  const { t } = useTranslation("common");
  const [currentFeedback, setCurrentFeedback] = useState<FeedbackType | null>(initialFeedback);
  const { data: existingFeedback } = useMyFeedback(entityType, entityId);
  const submitFeedback = useSubmitFeedback();
  const clearFeedback = useClearFeedback();

  const resolvedFeedback =
    currentFeedback ??
    (existingFeedback?.feedback as FeedbackType | null | undefined) ??
    null;

  const handleFeedback = (feedback: FeedbackType) => {
    // Toggle off if clicking the same button
    const newFeedback = resolvedFeedback === feedback ? null : feedback;

    if (newFeedback) {
      submitFeedback.mutate(
        {
          entity_type: entityType,
          entity_id: entityId,
          feedback: newFeedback,
        },
        {
          onSuccess: () => setCurrentFeedback(newFeedback),
        }
      );
    } else {
      clearFeedback.mutate(
        {
          entityType,
          entityId,
        },
        {
          onSuccess: () => setCurrentFeedback(null),
        },
      );
    }
  };

  const iconSize = size === "sm" ? "w-3.5 h-3.5" : "w-4 h-4";
  const buttonSize = size === "sm" ? "icon-xs" as const : "icon-sm" as const;

  return (
    <TooltipProvider>
      <div className="flex items-center gap-1">
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size={buttonSize}
              onClick={() => handleFeedback("like")}
              disabled={submitFeedback.isPending || clearFeedback.isPending}
              className={cn(
                "transition-colors",
                resolvedFeedback === "like" &&
                  "text-green-600 bg-green-50 hover:bg-green-100 hover:text-green-700 dark:bg-green-950 dark:hover:bg-green-900 dark:text-green-400"
              )}
            >
              <ThumbsUp className={iconSize} />
            </Button>
          </TooltipTrigger>
          <TooltipContent>{t("actions.like", "Helpful")}</TooltipContent>
        </Tooltip>

        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size={buttonSize}
              onClick={() => handleFeedback("dislike")}
              disabled={submitFeedback.isPending || clearFeedback.isPending}
              className={cn(
                "transition-colors",
                resolvedFeedback === "dislike" &&
                  "text-red-600 bg-red-50 hover:bg-red-100 hover:text-red-700 dark:bg-red-950 dark:hover:bg-red-900 dark:text-red-400"
              )}
            >
              <ThumbsDown className={iconSize} />
            </Button>
          </TooltipTrigger>
          <TooltipContent>{t("actions.dislike", "Not helpful")}</TooltipContent>
        </Tooltip>
      </div>
    </TooltipProvider>
  );
}
