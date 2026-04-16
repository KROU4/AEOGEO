// @vitest-environment jsdom
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { StepCreateProject } from "@/components/funnel/step-create-project";

const mutateAsync = vi.fn(async (payload: any) => ({ id: "project-1", ...payload }));

vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string) => key,
  }),
}));

vi.mock("sonner", () => ({
  toast: {
    error: vi.fn(),
  },
}));

vi.mock("@/hooks/use-projects", () => ({
  useCreateProject: () => ({
    mutateAsync,
    isPending: false,
  }),
}));

vi.mock("@/lib/api-client", () => ({
  apiPost: vi.fn(async () => ({
    valid: true,
    domain: "example.com",
    reachable: true,
    error: null,
  })),
}));

describe("StepCreateProject", () => {
  it("submits project payload with default content locale", async () => {
    const queryClient = new QueryClient();
    const onContinue = vi.fn();

    render(
      <QueryClientProvider client={queryClient}>
        <StepCreateProject onContinue={onContinue} />
      </QueryClientProvider>,
    );

    fireEvent.change(screen.getByTestId("funnel-project-name"), {
      target: { value: "My Project" },
    });
    fireEvent.change(screen.getByTestId("funnel-project-domain"), {
      target: { value: "https://example.com/path" },
    });

    await waitFor(() => {
      const button = screen.getByTestId("funnel-create-project-submit") as HTMLButtonElement;
      expect(button.disabled).toBe(false);
    });

    fireEvent.click(screen.getByTestId("funnel-create-project-submit"));

    await waitFor(() => {
      expect(mutateAsync).toHaveBeenCalledWith(
        expect.objectContaining({
          name: "My Project",
          content_locale: "en",
          domain: "example.com",
        }),
      );
    });

    expect(onContinue).toHaveBeenCalledWith("project-1");
  });
});
