import { Navigate, createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/_dashboard/platforms")({
  component: PlatformsRedirect,
});

function PlatformsRedirect() {
  return <Navigate to="/projects" replace />;
}
