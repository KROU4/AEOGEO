import { createFileRoute, Navigate } from "@tanstack/react-router";

export const Route = createFileRoute("/_funnel/new-project")({
  component: NewProjectRedirect,
});

function NewProjectRedirect() {
  return <Navigate to="/projects/new" replace />;
}
