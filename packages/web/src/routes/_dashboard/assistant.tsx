import { Navigate, createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/_dashboard/assistant")({
  component: AssistantRedirect,
});

function AssistantRedirect() {
  return <Navigate to="/projects" replace />;
}
