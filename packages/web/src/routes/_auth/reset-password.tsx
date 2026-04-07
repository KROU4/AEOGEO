import { SignIn, useAuth } from "@clerk/react";
import { Navigate, createFileRoute } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";

export const Route = createFileRoute("/_auth/reset-password")({
  component: ResetPasswordPage,
});

function ResetPasswordPage() {
  const { t } = useTranslation("auth");
  const { isLoaded, isSignedIn } = useAuth();

  if (isLoaded && isSignedIn) {
    return <Navigate to="/overview" />;
  }

  return (
    <div className="space-y-4">
      <p className="text-center text-sm text-muted-foreground">
        {t("resetPassword.clerkHint")}
      </p>
      <SignIn
        routing="path"
        path="/reset-password"
        fallbackRedirectUrl="/overview"
      />
    </div>
  );
}
