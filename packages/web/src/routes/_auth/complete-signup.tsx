import { useUser, useAuth } from "@clerk/react";
import { Navigate, createFileRoute, useRouter } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useBootstrap, useCurrentUser } from "@/hooks/use-auth";
import { ApiError } from "@/lib/api-client";
import { trackReferralSignup } from "@/lib/tolt";

export const Route = createFileRoute("/_auth/complete-signup")({
  component: CompleteSignupPage,
});

function CompleteSignupPage() {
  const { isLoaded, isSignedIn } = useAuth();
  const { user } = useUser();
  const router = useRouter();
  const { t } = useTranslation("auth");
  const { t: tc } = useTranslation("common");
  const currentUserQuery = useCurrentUser();
  const bootstrapMutation = useBootstrap();

  const [companyName, setCompanyName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [needsCompanyName, setNeedsCompanyName] = useState(false);
  const [autoAttempted, setAutoAttempted] = useState(false);

  useEffect(() => {
    if (!isLoaded || !isSignedIn) {
      return;
    }

    if (currentUserQuery.data) {
      void router.navigate({ to: "/overview" });
      return;
    }

    if (!(currentUserQuery.error instanceof ApiError)) {
      return;
    }

    if (currentUserQuery.error.code !== "auth.bootstrap_required") {
      setError(
        tc(`errors.${currentUserQuery.error.code}`, {
          defaultValue: tc("errors.unknown"),
        }),
      );
      return;
    }

    if (autoAttempted || bootstrapMutation.isPending) {
      return;
    }

    setAutoAttempted(true);
    bootstrapMutation.mutate(
      { name: user?.fullName ?? undefined },
      {
        onSuccess: () => {
          if (email) {
            void trackReferralSignup(email).catch(() => {});
          }
          void router.navigate({ to: "/overview" });
        },
        onError: (err) => {
          if (
            err instanceof ApiError &&
            err.code === "auth.company_name_required"
          ) {
            setNeedsCompanyName(true);
            return;
          }

          if (err instanceof ApiError) {
            setError(
              tc(`errors.${err.code}`, {
                defaultValue: tc("errors.unknown"),
              }),
            );
            return;
          }

          setError(t("completeSignup.failed"));
        },
      },
    );
  }, [
    autoAttempted,
    bootstrapMutation,
    currentUserQuery.data,
    currentUserQuery.error,
    isLoaded,
    isSignedIn,
    router,
    t,
    tc,
    user?.fullName,
  ]);

  if (!isLoaded) {
    return <div className="rounded-xl border bg-card p-8 text-center text-sm text-muted-foreground shadow-lg">Loading...</div>;
  }

  if (!isSignedIn) {
    return <Navigate to="/login" />;
  }

  if (currentUserQuery.data) {
    return <Navigate to="/overview" />;
  }

  const email = user?.primaryEmailAddress?.emailAddress || user?.emailAddresses[0]?.emailAddress;

  function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setError(null);

    if (!companyName.trim()) {
      setError(t("completeSignup.companyRequired"));
      return;
    }

    bootstrapMutation.mutate(
      {
        company_name: companyName.trim(),
        name: user?.fullName ?? undefined,
      },
      {
        onSuccess: () => {
          if (email) {
            void trackReferralSignup(email).catch(() => {});
          }
          void router.navigate({ to: "/overview" });
        },
        onError: (err) => {
          if (err instanceof ApiError) {
            setError(
              tc(`errors.${err.code}`, {
                defaultValue: tc("errors.unknown"),
              }),
            );
            return;
          }

          setError(t("completeSignup.failed"));
        },
      },
    );
  }

  if (!needsCompanyName) {
    return (
      <div className="rounded-xl border bg-card p-8 text-center shadow-lg">
        <h2 className="text-xl font-semibold text-foreground">
          {t("completeSignup.title")}
        </h2>
        <p className="mt-2 text-sm text-muted-foreground">
          {t("completeSignup.autoLinking")}
        </p>
      </div>
    );
  }

  return (
    <div className="rounded-xl border bg-card p-8 shadow-lg">
      <h2 className="text-center text-xl font-semibold text-foreground">
        {t("completeSignup.title")}
      </h2>
      <p className="mt-2 text-center text-sm text-muted-foreground">
        {t("completeSignup.subtitle")}
      </p>
      {email && (
        <p className="mt-2 text-center text-xs text-muted-foreground">
          {email}
        </p>
      )}
      <form onSubmit={handleSubmit} className="mt-6 space-y-4">
        <div className="space-y-2">
          <Label htmlFor="company-name">
            {t("completeSignup.companyLabel")}
          </Label>
          <Input
            id="company-name"
            value={companyName}
            onChange={(event) => setCompanyName(event.target.value)}
            placeholder={t("completeSignup.companyPlaceholder")}
          />
        </div>
        {error && <p className="text-sm text-destructive">{error}</p>}
        <Button type="submit" className="w-full" disabled={bootstrapMutation.isPending}>
          {bootstrapMutation.isPending
            ? t("completeSignup.submitting")
            : t("completeSignup.submit")}
        </Button>
      </form>
    </div>
  );
}
