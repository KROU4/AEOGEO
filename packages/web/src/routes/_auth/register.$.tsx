import { createFileRoute } from "@tanstack/react-router";
import { RegisterForm } from "./-register-shared";

export const Route = createFileRoute("/_auth/register/$")({
  component: RegisterForm,
});
