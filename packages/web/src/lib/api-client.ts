import { clearTokenCache, getAccessToken } from "@/lib/auth";

const BASE_URL = import.meta.env.VITE_API_URL || "";
const API_PREFIX = "/api/v1";

export class ApiError extends Error {
  code: string;
  status: number;

  constructor(status: number, code: string) {
    super(code);
    this.name = "ApiError";
    this.status = status;
    this.code = code;
  }
}

/** JSON request bodies — POST / PUT / PATCH. */
async function getAuthHeadersJson(): Promise<HeadersInit> {
  const headers: HeadersInit = {
    "Content-Type": "application/json",
  };

  const token = await getAccessToken();
  if (token) {
    headers["Authorization"] = `Bearer ${token}`;
  }

  return headers;
}

/** Bearer only — GET / DELETE (no body; avoid Content-Type on GET per HTTP semantics). */
async function getAuthHeadersAuthOnly(): Promise<HeadersInit> {
  const headers: HeadersInit = {};
  const token = await getAccessToken();
  if (token) {
    headers["Authorization"] = `Bearer ${token}`;
  }
  return headers;
}

/** Authorization only (e.g. binary downloads — avoid JSON Content-Type on GET). */
async function getAuthHeadersBinary(): Promise<HeadersInit> {
  return getAuthHeadersAuthOnly();
}

function buildUrl(path: string): string {
  return `${BASE_URL}${API_PREFIX}${path}`;
}

async function handleResponse<T>(
  response: Response,
  options?: { redirectOnUnauthorized?: boolean },
): Promise<T> {
  const redirectOnUnauthorized = options?.redirectOnUnauthorized ?? true;
  if (response.status === 401) {
    if (redirectOnUnauthorized) {
      window.location.href =
        "/login?redirect_url=" + encodeURIComponent(window.location.pathname);
    }
    throw new ApiError(401, "auth.invalid_token");
  }
  if (!response.ok) {
    let code = "unknown";
    try {
      const body = await response.json();
      if (body?.detail?.code) {
        code = body.detail.code;
      } else if (typeof body?.detail === "string") {
        code = body.detail;
      }
    } catch {
      // response body not JSON
    }
    throw new ApiError(response.status, code);
  }
  if (response.status === 204 || response.status === 205) {
    return undefined as T;
  }

  const contentLength = response.headers.get("content-length");
  if (contentLength === "0") {
    return undefined as T;
  }

  return response.json() as Promise<T>;
}

export async function apiGet<T>(path: string): Promise<T> {
  let response = await fetch(buildUrl(path), {
    method: "GET",
    headers: await getAuthHeadersAuthOnly(),
  });
  if (response.status === 401) {
    clearTokenCache();
    response = await fetch(buildUrl(path), {
      method: "GET",
      headers: await getAuthHeadersAuthOnly(),
    });
  }
  return handleResponse<T>(response);
}

export async function apiGetBlob(path: string): Promise<Blob> {
  const response = await fetch(buildUrl(path), {
    method: "GET",
    headers: await getAuthHeadersBinary(),
  });
  if (response.status === 401) {
    window.location.href =
      "/login?redirect_url=" + encodeURIComponent(window.location.pathname);
    throw new ApiError(401, "auth.invalid_token");
  }
  if (!response.ok) {
    let code = "unknown";
    try {
      const body = await response.json();
      if (body?.detail?.code) {
        code = body.detail.code;
      } else if (typeof body?.detail === "string") {
        code = body.detail;
      }
    } catch {
      // response body not JSON
    }
    throw new ApiError(response.status, code);
  }
  return response.blob();
}

export async function apiGetPublic<T>(path: string): Promise<T> {
  const response = await fetch(buildUrl(path), {
    method: "GET",
    headers: {
      "Content-Type": "application/json",
    },
  });
  return handleResponse<T>(response, { redirectOnUnauthorized: false });
}

/** Public POST (no auth header) — e.g. lead-gen quick audit. */
export async function apiPostPublic<T>(path: string, body?: unknown): Promise<T> {
  const response = await fetch(buildUrl(path), {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  return handleResponse<T>(response, { redirectOnUnauthorized: false });
}

/** Public PATCH (no auth header). */
export async function apiPatchPublic<T>(path: string, body?: unknown): Promise<T> {
  const response = await fetch(buildUrl(path), {
    method: "PATCH",
    headers: {
      "Content-Type": "application/json",
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  return handleResponse<T>(response, { redirectOnUnauthorized: false });
}

export async function apiPost<T>(path: string, body?: unknown): Promise<T> {
  const response = await fetch(buildUrl(path), {
    method: "POST",
    headers: await getAuthHeadersJson(),
    body: body ? JSON.stringify(body) : undefined,
  });
  return handleResponse<T>(response);
}

export async function apiPut<T>(path: string, body?: unknown): Promise<T> {
  const response = await fetch(buildUrl(path), {
    method: "PUT",
    headers: await getAuthHeadersJson(),
    body: body ? JSON.stringify(body) : undefined,
  });
  return handleResponse<T>(response);
}

export async function apiPatch<T>(path: string, body?: unknown): Promise<T> {
  const response = await fetch(buildUrl(path), {
    method: "PATCH",
    headers: await getAuthHeadersJson(),
    body: body ? JSON.stringify(body) : undefined,
  });
  return handleResponse<T>(response);
}

export async function apiDelete<T>(path: string): Promise<T> {
  const response = await fetch(buildUrl(path), {
    method: "DELETE",
    headers: await getAuthHeadersAuthOnly(),
  });
  return handleResponse<T>(response);
}

export interface SSEEvent {
  event: string;
  data: unknown;
}

async function consumeSseResponse(
  response: Response,
  onEvent: (event: SSEEvent) => void,
): Promise<void> {
  const reader = response.body!.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true });
    const parts = buffer.split("\n\n");
    buffer = parts.pop() || "";

    for (const part of parts) {
      let eventName = "";
      let eventData = "";
      for (const line of part.split("\n")) {
        if (line.startsWith("event: ")) eventName = line.slice(7);
        else if (line.startsWith("data: ")) eventData = line.slice(6);
      }
      if (!eventData) continue;
      const ev = eventName || "message";
      try {
        onEvent({ event: ev, data: JSON.parse(eventData) });
      } catch {
        onEvent({ event: ev, data: eventData });
      }
    }
  }
}

export async function apiSSE(
  path: string,
  body: unknown,
  onEvent: (event: SSEEvent) => void,
  signal?: AbortSignal,
): Promise<void> {
  const headers = await getAuthHeadersJson();
  const response = await fetch(buildUrl(path), {
    method: "POST",
    headers,
    body: JSON.stringify(body),
    signal,
  });

  if (response.status === 401) {
    window.location.href =
      "/login?redirect_url=" + encodeURIComponent(window.location.pathname);
    throw new ApiError(401, "auth.invalid_token");
  }
  if (!response.ok) {
    throw new ApiError(response.status, "sse_stream_failed");
  }

  await consumeSseResponse(response, onEvent);
}

/** GET + SSE (e.g. assistant report stream). */
export async function apiSSEGet(
  path: string,
  onEvent: (event: SSEEvent) => void,
  signal?: AbortSignal,
): Promise<void> {
  const headers = await getAuthHeadersBinary();
  const response = await fetch(buildUrl(path), {
    method: "GET",
    headers,
    signal,
  });

  if (response.status === 401) {
    window.location.href =
      "/login?redirect_url=" + encodeURIComponent(window.location.pathname);
    throw new ApiError(401, "auth.invalid_token");
  }
  if (!response.ok) {
    throw new ApiError(response.status, "sse_stream_failed");
  }

  await consumeSseResponse(response, onEvent);
}

export async function apiUpload<T>(path: string, formData: FormData): Promise<T> {
  const headers: HeadersInit = {};
  const token = await getAccessToken();
  if (token) {
    headers["Authorization"] = `Bearer ${token}`;
  }
  // Do NOT set Content-Type — browser sets it with boundary for multipart/form-data
  const response = await fetch(buildUrl(path), {
    method: "POST",
    headers,
    body: formData,
  });
  return handleResponse<T>(response);
}
