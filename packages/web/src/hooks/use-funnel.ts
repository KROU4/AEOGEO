import { useState, useCallback } from "react";

const STORAGE_KEY = "aeogeo_funnel_state";

interface FunnelState {
  projectId: string | null;
  querySetId: string | null;
  runIds: string[];
  completedSteps: number[];
}

const DEFAULT_STATE: FunnelState = {
  projectId: null,
  querySetId: null,
  runIds: [],
  completedSteps: [],
};

function loadState(): FunnelState {
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    if (raw) return JSON.parse(raw);
  } catch {
    // ignore
  }
  return DEFAULT_STATE;
}

function saveState(state: FunnelState) {
  try {
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    // ignore
  }
}

export function useFunnel() {
  const [state, setState] = useState<FunnelState>(loadState);

  const update = useCallback((partial: Partial<FunnelState>) => {
    setState((prev) => {
      const next = { ...prev, ...partial };
      saveState(next);
      return next;
    });
  }, []);

  const setProjectId = useCallback(
    (id: string) => update({ projectId: id }),
    [update],
  );

  const setQuerySetId = useCallback(
    (id: string) => update({ querySetId: id }),
    [update],
  );

  const addRunId = useCallback(
    (id: string) =>
      setState((prev) => {
        const next = { ...prev, runIds: [...prev.runIds, id] };
        saveState(next);
        return next;
      }),
    [],
  );

  const markComplete = useCallback(
    (step: number) =>
      setState((prev) => {
        if (prev.completedSteps.includes(step)) return prev;
        const next = { ...prev, completedSteps: [...prev.completedSteps, step] };
        saveState(next);
        return next;
      }),
    [],
  );

  const isStepComplete = useCallback(
    (step: number) => state.completedSteps.includes(step),
    [state.completedSteps],
  );

  const reset = useCallback(() => {
    sessionStorage.removeItem(STORAGE_KEY);
    setState(DEFAULT_STATE);
  }, []);

  return {
    ...state,
    setProjectId,
    setQuerySetId,
    addRunId,
    markComplete,
    isStepComplete,
    reset,
  };
}
