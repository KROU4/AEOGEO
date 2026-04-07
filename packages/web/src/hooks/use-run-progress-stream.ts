import { useCallback, useEffect, useRef, useState } from "react";
import { apiSSE } from "@/lib/api-client";

export type RunStreamPhase = "idle" | "connecting" | "running" | "complete" | "error";

export interface StageProgress {
  status: string;
  total: number;
  completed: number;
}

export interface RunProgressState {
  runId: string;
  engineName: string;
  status: string;
  errorMessage: string | null;
  engine: StageProgress;
  parse: StageProgress;
  score: StageProgress;
}

export interface RunProgressStreamState {
  phase: RunStreamPhase;
  runs: Record<string, RunProgressState>;
  error: string | null;
}

const INITIAL_STATE: RunProgressStreamState = {
  phase: "idle",
  runs: {},
  error: null,
};

export function useRunProgressStream(projectId: string) {
  const [state, setState] = useState<RunProgressStreamState>(INITIAL_STATE);
  const abortRef = useRef<AbortController | null>(null);
  const engineMapRef = useRef<Record<string, string>>({});

  const start = useCallback(
    async (runIds: string[], engineMap: Record<string, string>) => {
      abortRef.current?.abort();
      const controller = new AbortController();
      abortRef.current = controller;
      engineMapRef.current = engineMap;

      setState({ ...INITIAL_STATE, phase: "connecting" });

      try {
        await apiSSE(
          `/projects/${projectId}/runs/stream/progress`,
          { run_ids: runIds },
          (event) => {
            const d = event.data as Record<string, unknown>;
            switch (event.event) {
              case "stream_start":
                setState((s) => ({ ...s, phase: "running" }));
                break;
              case "run_update": {
                const runId = d.run_id as string;
                setState((s) => ({
                  ...s,
                  runs: {
                    ...s.runs,
                    [runId]: {
                      runId,
                      engineName: engineMapRef.current[runId] ?? "Engine",
                      status: d.status as string,
                      errorMessage: (d.error_message as string) ?? null,
                      engine: d.engine as StageProgress,
                      parse: d.parse as StageProgress,
                      score: d.score as StageProgress,
                    },
                  },
                }));
                break;
              }
              case "all_complete":
                setState((s) => ({ ...s, phase: "complete" }));
                break;
              case "timeout":
                setState((s) => ({ ...s, phase: "error", error: "Stream timed out" }));
                break;
            }
          },
          controller.signal,
        );
      } catch (err) {
        if ((err as Error).name !== "AbortError") {
          setState((s) => ({
            ...s,
            phase: "error",
            error: (err as Error).message || "Stream failed",
          }));
        }
      }
    },
    [projectId],
  );

  useEffect(() => {
    return () => abortRef.current?.abort();
  }, []);

  return { ...state, start };
}
