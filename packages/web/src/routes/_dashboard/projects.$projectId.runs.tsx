import { Navigate, createFileRoute, useParams } from "@tanstack/react-router";

export const Route = createFileRoute("/_dashboard/projects/$projectId/runs")({
  component: ProjectRunsRedirect,
});

function ProjectRunsRedirect() {
  const { projectId } = useParams({
    from: "/_dashboard/projects/$projectId/runs",
  });
  return (
    <Navigate
      to="/projects/$projectId/site-audit"
      params={{ projectId }}
      replace
    />
  );
}
