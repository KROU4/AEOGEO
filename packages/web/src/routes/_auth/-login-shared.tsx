import { SignIn, useAuth } from "@clerk/react";
import { Navigate } from "@tanstack/react-router";

export type LoginSearch = {
  redirect_url?: string;
};

export function validateLoginSearch(
  search: Record<string, unknown>,
): LoginSearch {
  return {
    redirect_url:
      typeof search.redirect_url === "string"
        ? search.redirect_url
        : undefined,
  };
}

export function LoginForm({ returnTo }: { returnTo: string }) {
  const { isLoaded, isSignedIn } = useAuth();

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
