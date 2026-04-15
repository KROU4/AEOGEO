import { useCallback, useEffect, useRef, useState } from "react";

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

/** Knowledge crawl SSE removed; local complete state keeps onboarding usable. */
export function useCrawlStream(_projectId: string) {
  const [state, setState] = useState<CrawlStreamState>(INITIAL_STATE);
  const abortRef = useRef<AbortController | null>(null);

  const start = useCallback(async (_domain: string, _maxPages: number) => {
    void _projectId;
    abortRef.current?.abort();
    setState({
      ...INITIAL_STATE,
      phase: "complete",
      entriesCreated: 0,
    });
  }, []);

  useEffect(() => {
    return () => abortRef.current?.abort();
  }, []);

  return { ...state, start };
}
