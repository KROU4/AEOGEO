import { SignIn, useAuth } from "@clerk/react";
import { Navigate } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";

export function ForgotPasswordForm() {
  const { t } = useTranslation("auth");
  const { isLoaded, isSignedIn } = useAuth();

  if (isLoaded && isSignedIn) {
    return <Navigate to="/overview" />;
  }

  return (
    <div className="space-y-4">
      <p className="text-center text-sm text-muted-foreground">
        {t("forgotPassword.clerkHint")}
      </p>
      <SignIn
        routing="path"
        path="/forgot-password"
        fallbackRedirectUrl="/overview"
      />
    </div>
  );
}
