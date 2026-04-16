// @vitest-environment jsdom
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { renderHook, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { describe, expect, it, vi } from "vitest";
import { useCreateRun } from "@/hooks/use-runs";

const { apiPostMock } = vi.hoisted(() => ({
  apiPostMock: vi.fn(async () => ({
    id: "run-1",
    project_id: "project-1",
    query_set_id: "qs-1",
    engine_id: "eng-1",
    sample_count: 3,
    status: "pending",
    triggered_by: "manual",
    created_at: "2026-04-16T10:00:00Z",
    updated_at: "2026-04-16T10:00:00Z",
  })),
}));

vi.mock("@/lib/api-client", () => ({
  apiGet: vi.fn(),
  apiPost: apiPostMock,
  ApiError: class ApiError extends Error {},
}));

describe("useCreateRun", () => {
  it("posts run payload to project endpoint", async () => {
    const queryClient = new QueryClient();
    const wrapper = ({ children }: { children: ReactNode }) => (
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    );

    const { result } = renderHook(() => useCreateRun("project-1"), { wrapper });

    await result.current.mutateAsync({
      query_set_id: "qs-1",
      engine_id: "eng-1",
      sample_count: 3,
    });

    await waitFor(() => {
      expect(apiPostMock).toHaveBeenCalledWith("/projects/project-1/runs", {
        query_set_id: "qs-1",
        engine_id: "eng-1",
        sample_count: 3,
      });
    });
  });
});
