import { createFileRoute, useSearch } from "@tanstack/react-router";
import { LoginForm, validateLoginSearch } from "./-login-shared";

export const Route = createFileRoute("/_auth/login/$")({
  validateSearch: validateLoginSearch,
  component: LoginPageSplat,
});

function LoginPageSplat() {
  const { redirect_url } = useSearch({ from: "/_auth/login/$" });
  return <LoginForm returnTo={redirect_url || "/overview"} />;
}
