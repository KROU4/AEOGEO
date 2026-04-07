import { SignIn, useAuth } from "@clerk/react";
import { Navigate, createFileRoute, useSearch } from "@tanstack/react-router";

type LoginSearch = {
  redirect_url?: string;
};

export const Route = createFileRoute("/_auth/login")({
  component: LoginPage,
  validateSearch: (search: Record<string, unknown>): LoginSearch => ({
    redirect_url: typeof search.redirect_url === "string" ? search.redirect_url : undefined,
  }),
});

function LoginPage() {
  const { isLoaded, isSignedIn } = useAuth();
  const { redirect_url } = useSearch({ from: "/_auth/login" });
  const returnTo = redirect_url || "/overview";

  if (isLoaded && isSignedIn) {
    return <Navigate to={returnTo} />;
  }

  return (
    <SignIn
      routing="path"
      path="/login"
      fallbackRedirectUrl={returnTo}
    />
  );
}
