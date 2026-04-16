import { Navigate, createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/_dashboard/visibility")({
  component: VisibilityRedirect,
});

function VisibilityRedirect() {
  return <Navigate to="/projects" replace />;
}
