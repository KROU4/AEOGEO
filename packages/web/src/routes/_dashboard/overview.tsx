import { Navigate, createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/_dashboard/overview")({
  component: OverviewRedirect,
});

function OverviewRedirect() {
  return <Navigate to="/projects" replace />;
}
