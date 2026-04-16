import { Navigate, createFileRoute, useParams } from "@tanstack/react-router";

export const Route = createFileRoute("/_dashboard/projects/$projectId/queries")({
  component: ProjectQueriesRedirect,
});

function ProjectQueriesRedirect() {
  const { projectId } = useParams({
    from: "/_dashboard/projects/$projectId/queries",
  });
  return (
    <Navigate
      to="/projects/$projectId/site-audit"
      params={{ projectId }}
      replace
    />
  );
}
