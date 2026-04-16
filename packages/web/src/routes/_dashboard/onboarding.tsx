import { Navigate, createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/_dashboard/onboarding")({
  component: OnboardingRoute,
});

export function OnboardingRoute() {
  return <Navigate to="/projects/new" replace />;
}
