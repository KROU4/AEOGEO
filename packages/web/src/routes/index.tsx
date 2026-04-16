import { createFileRoute, Navigate } from "@tanstack/react-router";
import { AvopLanding } from "@/components/marketing/avop-landing";
import { useSessionAuth } from "@/lib/session-auth";

export const Route = createFileRoute("/")({
  component: HomePage,
});

function HomePage() {
  const { isLoaded, isSignedIn } = useSessionAuth();

  if (!isLoaded) {
    return (
      <div className="flex min-h-screen items-center justify-center text-sm text-muted-foreground">
        Loading...
      </div>
    );
  }

  if (isSignedIn) {
    return <Navigate to="/projects" />;
  }

  return <AvopLanding />;
}
