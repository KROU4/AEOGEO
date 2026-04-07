import { useCallback, useEffect, useRef, useState } from "react";
import { apiSSE } from "@/lib/api-client";

export type CrawlPhase =
  | "idle"
  | "connecting"
  | "crawling"
  | "extracting"
  | "embedding"
  | "complete"
  | "error";

export interface CrawlPage {
  url: string;
  title: string;
  status: string;
  content_preview?: string | null;
  error_message?: string | null;
}

export interface CrawlEntry {
  type: string;
  content: string;
  source_url?: string | null;
}

export interface CrawlStreamState {
  phase: CrawlPhase;
  pages: CrawlPage[];
  entries: CrawlEntry[];
  pagesDone: number;
  pagesTotal: number;
  extractionDone: number;
  extractionTotal: number;
  entriesCreated: number;
  error: string | null;
}

const INITIAL_STATE: CrawlStreamState = {
  phase: "idle",
  pages: [],
  entries: [],
  pagesDone: 0,
  pagesTotal: 0,
  extractionDone: 0,
  extractionTotal: 0,
  entriesCreated: 0,
  error: null,
};

export function useCrawlStream(projectId: string) {
  const [state, setState] = useState<CrawlStreamState>(INITIAL_STATE);
  const abortRef = useRef<AbortController | null>(null);

  const start = useCallback(
    async (domain: string, maxPages: number) => {
      abortRef.current?.abort();
      const controller = new AbortController();
      abortRef.current = controller;

      setState({ ...INITIAL_STATE, phase: "connecting" });

      try {
        await apiSSE(
          `/projects/${projectId}/knowledge/crawl/stream`,
          { domain, max_pages: maxPages },
          (event) => {
            const d = event.data as Record<string, unknown>;
            switch (event.event) {
              case "crawl_start":
                setState((s) => ({ ...s, phase: "crawling" }));
                break;
              case "page_crawled":
                setState((s) => ({
                  ...s,
                  pages: [
                    ...s.pages,
                    {
                      url: d.url as string,
                      title: d.title as string,
                      status: d.status as string,
                      content_preview: d.content_preview as string | null,
                      error_message: d.error_message as string | null,
                    },
                  ],
                  pagesDone: d.pages_done as number,
                  pagesTotal: d.pages_total as number,
                }));
                break;
              case "page_extracted":
                setState((s) => ({
                  ...s,
                  phase: "extracting",
                  entries: [
                    ...s.entries,
                    ...((d.entries as CrawlEntry[]) || []),
                  ],
                  extractionDone: d.extraction_done as number,
                  extractionTotal: d.extraction_total as number,
                  entriesCreated: d.entries_total as number,
                }));
                break;
              case "embedding_start":
                setState((s) => ({ ...s, phase: "embedding" }));
                break;
              case "complete":
                setState((s) => ({
                  ...s,
                  phase: "complete",
                  entriesCreated: d.entries_created as number,
                }));
                break;
              case "error":
                setState((s) => ({
                  ...s,
                  phase: "error",
                  error: d.message as string,
                }));
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
