// @vitest-environment jsdom
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { renderHook, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { describe, expect, it, vi } from "vitest";
import { useUpdateIntegrationSettings } from "@/hooks/use-settings";

const { apiPatchMock } = vi.hoisted(() => ({
  apiPatchMock: vi.fn(async () => ({
    generic_webhook_url: "https://example.com/hooks",
    slack_webhook_url: null,
    slack_enabled: true,
  })),
}));

vi.mock("@/lib/api-client", () => ({
  apiGet: vi.fn(),
  apiPatch: apiPatchMock,
}));

describe("useUpdateIntegrationSettings", () => {
  it("updates integration settings cache after mutation", async () => {
    const queryClient = new QueryClient();
    const wrapper = ({ children }: { children: ReactNode }) => (
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    );

    const { result } = renderHook(() => useUpdateIntegrationSettings(), { wrapper });

    await result.current.mutateAsync({
      generic_webhook_url: "https://example.com/hooks",
      slack_enabled: true,
    });

    await waitFor(() => {
      expect(apiPatchMock).toHaveBeenCalledWith("/settings/integrations", {
        generic_webhook_url: "https://example.com/hooks",
        slack_enabled: true,
      });
    });

    expect(queryClient.getQueryData(["settings", "integrations"])).toEqual({
      generic_webhook_url: "https://example.com/hooks",
      slack_webhook_url: null,
      slack_enabled: true,
    });
  });
});
