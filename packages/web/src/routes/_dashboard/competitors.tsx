import { Navigate, createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/_dashboard/competitors")({
  component: CompetitorsRedirect,
});

function CompetitorsRedirect() {
  return <Navigate to="/projects" replace />;
}
