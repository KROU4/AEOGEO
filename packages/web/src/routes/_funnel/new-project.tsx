import { createFileRoute, useNavigate, useSearch } from "@tanstack/react-router";
import { useFunnel } from "@/hooks/use-funnel";
import { StepCreateProject } from "@/components/funnel/step-create-project";
import { StepCrawl } from "@/components/funnel/step-crawl";
import { StepKnowledge } from "@/components/funnel/step-knowledge";
import { StepKeywords } from "@/components/funnel/step-keywords";
import { StepQuestions } from "@/components/funnel/step-questions";
import { StepRunEngines } from "@/components/funnel/step-run-engines";
import { StepScores } from "@/components/funnel/step-scores";
import { StepRecommendations } from "@/components/funnel/step-recommendations";

type SearchParams = { step?: number };

export const Route = createFileRoute("/_funnel/new-project")({
  component: NewProjectFunnel,
  validateSearch: (search: Record<string, unknown>): SearchParams => ({
    step: Number(search.step) || 1,
  }),
});

const TOTAL_STEPS = 8;

function NewProjectFunnel() {
  const navigate = useNavigate();
  const { step } = useSearch({ from: "/_funnel/new-project" });
  const currentStep = Math.max(1, Math.min(step ?? 1, TOTAL_STEPS));
  const funnel = useFunnel();

  const goToStep = (nextStep: number) => {
    navigate({
      to: "/new-project",
      search: { step: nextStep },
      replace: true,
    });
  };

  const onContinue = () => {
    funnel.markComplete(currentStep);
    if (currentStep < TOTAL_STEPS) {
      goToStep(currentStep + 1);
    }
  };

  const onBack = () => {
    if (currentStep > 1) {
      goToStep(currentStep - 1);
    }
  };

  switch (currentStep) {
    case 1:
      return (
        <StepCreateProject
          onContinue={(projectId) => {
            funnel.setProjectId(projectId);
            onContinue();
          }}
        />
      );
    case 2:
      return (
        <StepCrawl
          projectId={funnel.projectId!}
          onContinue={onContinue}
          onBack={onBack}
        />
      );
    case 3:
      return (
        <StepKnowledge
          projectId={funnel.projectId!}
          onContinue={onContinue}
          onBack={onBack}
        />
      );
    case 4:
      return (
        <StepKeywords
          projectId={funnel.projectId!}
          onContinue={onContinue}
          onBack={onBack}
        />
      );
    case 5:
      return (
        <StepQuestions
          projectId={funnel.projectId!}
          onContinue={(querySetId) => {
            funnel.setQuerySetId(querySetId);
            onContinue();
          }}
          onBack={onBack}
        />
      );
    case 6:
      return (
        <StepRunEngines
          projectId={funnel.projectId!}
          querySetId={funnel.querySetId!}
          onContinue={(runIds) => {
            runIds.forEach((id) => funnel.addRunId(id));
            onContinue();
          }}
          onBack={onBack}
        />
      );
    case 7:
      return (
        <StepScores
          projectId={funnel.projectId!}
          onContinue={onContinue}
          onBack={onBack}
        />
      );
    case 8:
      return (
        <StepRecommendations
          projectId={funnel.projectId!}
          onFinish={() => {
            funnel.reset();
            navigate({ to: "/overview" });
          }}
          onBack={onBack}
        />
      );
    default:
      return null;
  }
}
