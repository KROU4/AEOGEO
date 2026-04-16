import { Navigate, createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/_dashboard/citations")({
  component: CitationsRedirect,
});

function CitationsRedirect() {
  return <Navigate to="/projects" replace />;
}
