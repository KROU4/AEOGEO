import { apiSSE, apiSSEGet } from "@/lib/api-client";

type SsePayload = {
  chunk?: string;
  done?: boolean;
  full_text?: string;
};

function payloadFromEvent(data: unknown): SsePayload {
  if (data && typeof data === "object" && !Array.isArray(data)) {
    return data as SsePayload;
  }
  return {};
}

/** Latest completed run (or `runId`) — executive summary via SSE chunks. */
export async function streamAssistantSummary(
  projectId: string,
  options: { runId?: string },
  onChunk: (text: string) => void,
  signal?: AbortSignal,
): Promise<string> {
  const q = options.runId
    ? `?run_id=${encodeURIComponent(options.runId)}`
    : "";
  let acc = "";
  await apiSSEGet(
    `/projects/${projectId}/assistant/summary${q}`,
    (ev) => {
      const p = payloadFromEvent(ev.data);
      if (p.chunk) {
        acc += p.chunk;
        onChunk(p.chunk);
      }
      if (p.done && p.full_text) {
        acc = p.full_text;
      }
    },
    signal,
  );
  return acc;
}

export async function streamAssistantReport(
  projectId: string,
  period: string,
  onChunk: (text: string) => void,
  signal?: AbortSignal,
): Promise<string> {
  let acc = "";
  await apiSSEGet(
    `/projects/${projectId}/assistant/report?period=${encodeURIComponent(period)}`,
    (ev) => {
      const p = payloadFromEvent(ev.data);
      if (p.chunk) {
        acc += p.chunk;
        onChunk(p.chunk);
      }
      if (p.done && p.full_text) {
        acc = p.full_text;
      }
    },
    signal,
  );
  return acc;
}

export async function streamAssistantChat(
  projectId: string,
  body: { message: string; history: { role: string; content: string }[] },
  onChunk: (text: string) => void,
  signal?: AbortSignal,
): Promise<string> {
  let acc = "";
  await apiSSE(
    `/projects/${projectId}/assistant/chat`,
    body,
    (ev) => {
      const p = payloadFromEvent(ev.data);
      if (p.chunk) {
        acc += p.chunk;
        onChunk(p.chunk);
      }
      if (p.done && p.full_text) {
        acc = p.full_text;
      }
    },
    signal,
  );
  return acc;
}
