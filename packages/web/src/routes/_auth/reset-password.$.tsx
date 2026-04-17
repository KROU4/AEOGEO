import { createFileRoute } from "@tanstack/react-router";
import { ResetPasswordForm } from "./-reset-password-shared";

export const Route = createFileRoute("/_auth/reset-password/$")({
  component: ResetPasswordForm,
});
