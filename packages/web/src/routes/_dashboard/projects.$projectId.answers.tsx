import { Navigate, createFileRoute, useParams } from "@tanstack/react-router";

export const Route = createFileRoute("/_dashboard/projects/$projectId/answers")({
  component: ProjectAnswersRedirect,
});

function ProjectAnswersRedirect() {
  const { projectId } = useParams({
    from: "/_dashboard/projects/$projectId/answers",
  });
  return (
    <Navigate
      to="/projects/$projectId/site-audit"
      params={{ projectId }}
      replace
    />
  );
}
