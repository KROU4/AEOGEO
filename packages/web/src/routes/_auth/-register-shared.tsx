import { SignUp, useAuth } from "@clerk/react";
import { Navigate } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";

export function RegisterForm() {
  const { t } = useTranslation("auth");
  const { isLoaded, isSignedIn } = useAuth();

  if (isLoaded && isSignedIn) {
    return <Navigate to="/complete-signup" />;
  }

  return (
    <div className="space-y-4">
      <p className="text-center text-sm text-muted-foreground">
        {t("register.clerkHint")}
      </p>
      <SignUp
        routing="path"
        path="/register"
        signInUrl="/login"
        fallbackRedirectUrl="/complete-signup"
        forceRedirectUrl="/complete-signup"
      />
    </div>
  );
}
