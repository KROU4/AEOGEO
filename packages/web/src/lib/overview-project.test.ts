import { describe, expect, it } from "vitest";
import {
  ANALYTICS_PROJECT_STORAGE_KEY,
  clearStoredAnalyticsProjectId,
  readStoredAnalyticsProjectId,
  resolveAnalyticsProjectId,
  writeStoredAnalyticsProjectId,
} from "./overview-project";

function createStorage() {
  const values = new Map<string, string>();

  return {
    getItem(key: string) {
      return values.get(key) ?? null;
    },
    setItem(key: string, value: string) {
      values.set(key, value);
    },
    removeItem(key: string) {
      values.delete(key);
    },
  };
}

describe("resolveAnalyticsProjectId", () => {
  const projects = [
    { id: "project-old", created_at: "2025-01-01T00:00:00Z" },
    { id: "project-new", created_at: "2025-02-01T00:00:00Z" },
  ];

  it("keeps a stored project when it still exists", () => {
    expect(resolveAnalyticsProjectId(projects, "project-old")).toBe("project-old");
  });

  it("falls back to the oldest project when the stored id is missing", () => {
    expect(resolveAnalyticsProjectId(projects, "project-missing")).toBe("project-old");
  });

  it("returns null when no projects exist", () => {
    expect(resolveAnalyticsProjectId([], "project-missing")).toBeNull();
  });
});

describe("analytics project storage helpers", () => {
  it("reads, writes, and clears the stored project id", () => {
    const storage = createStorage();

    writeStoredAnalyticsProjectId("project-123", storage);
    expect(readStoredAnalyticsProjectId(storage)).toBe("project-123");
    expect(storage.getItem(ANALYTICS_PROJECT_STORAGE_KEY)).toBe("project-123");

    clearStoredAnalyticsProjectId(storage);
    expect(readStoredAnalyticsProjectId(storage)).toBeNull();
  });
});
