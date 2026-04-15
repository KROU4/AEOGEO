import { useAuth } from "@clerk/react";
import { createFileRoute, Navigate } from "@tanstack/react-router";
import { AvopLanding } from "@/components/marketing/avop-landing";

export const Route = createFileRoute("/")({
  component: HomePage,
});

function HomePage() {
  const { isLoaded, isSignedIn } = useAuth();

  if (!isLoaded) {
    return (
      <div className="flex min-h-screen items-center justify-center text-sm text-muted-foreground">
        Loading...
      </div>
    );
  }

  if (isSignedIn) {
    return <Navigate to="/overview" />;
  }

  return <AvopLanding />;
}
