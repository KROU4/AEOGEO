export function buildAbsoluteShareUrl(
  path: string,
  origin =
    typeof window !== "undefined" ? window.location.origin : "http://localhost",
): string {
  return new URL(path, origin).toString();
}

export function formatVisibilityScore(score: number): string {
  return score.toFixed(1);
}

export function triggerBlobDownload(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.rel = "noopener";
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}
