import type { WidgetData, WidgetEventCreate } from "./types";

function resolveApiBase(): string {
  if (typeof window !== "undefined") {
    const { hostname, origin } = window.location;
    if (hostname === "localhost" || hostname === "127.0.0.1") {
      return `${origin}/api/v1/public/widgets`;
    }
  }

  return "https://api.sand-source.com/api/v1/public/widgets";
}

export async function fetchWidgetContent(
  embedToken: string,
): Promise<WidgetData> {
  const resp = await fetch(`${resolveApiBase()}/${embedToken}/content`);
  if (!resp.ok) {
    throw new Error(`Widget API error: ${resp.status}`);
  }
  return resp.json();
}

export async function sendWidgetEvent(
  embedToken: string,
  body: WidgetEventCreate,
): Promise<void> {
  const resp = await fetch(`${resolveApiBase()}/${embedToken}/events`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });

  if (!resp.ok) {
    throw new Error(`Widget event API error: ${resp.status}`);
  }
}
