import { createFileRoute } from "@tanstack/react-router";
import { ForgotPasswordForm } from "./-forgot-password-shared";

export const Route = createFileRoute("/_auth/forgot-password/$")({
  component: ForgotPasswordForm,
});
