import { describe, expect, it, vi } from "vitest";
import {
  DEFAULT_STARTER_SAMPLE_COUNT,
  STARTER_QUERY_COUNT,
  STARTER_QUERY_SET_NAME,
  finishSetupLater,
  startFirstRun,
} from "./onboarding-launch";

describe("finishSetupLater", () => {
  it("saves only non-empty catalog entries", async () => {
    const saveProduct = vi.fn(async () => undefined);
    const saveCompetitor = vi.fn(async () => undefined);

    await finishSetupLater(
      [{ name: "Platform", description: "", category: "", pricing: "", features: [] }],
      [
        { name: "", website: "", positioning: "", notes: "" },
        { name: "Competitor", website: "", positioning: "", notes: "" },
      ],
      { saveProduct, saveCompetitor },
    );

    expect(saveProduct).toHaveBeenCalledTimes(1);
    expect(saveCompetitor).toHaveBeenCalledTimes(1);
  });
});

describe("startFirstRun", () => {
  it("creates a starter query set, generates starter queries, approves them, and creates runs", async () => {
    const createQuerySet = vi.fn(async () => ({
      id: "query-set-1",
      name: STARTER_QUERY_SET_NAME,
      description: "",
      project_id: "project-1",
      query_count: 0,
      created_at: "2025-01-01T00:00:00Z",
    }));
    const listQueries = vi.fn(async () => []);
    const generateQueries = vi.fn(async () => ({
      generated: 2,
      queries: [
        {
          id: "query-1",
          text: "best tools for revenue teams",
          category: "commercial",
          priority: 3,
          status: "draft",
          query_set_id: "query-set-1",
          cluster_id: null,
          created_at: "2025-01-01T00:00:00Z",
        },
        {
          id: "query-2",
          text: "how to automate outbound email",
          category: "informational",
          priority: 3,
          status: "draft",
          query_set_id: "query-set-1",
          cluster_id: null,
          created_at: "2025-01-01T00:00:00Z",
        },
      ],
    }));
    const approveQueries = vi.fn(async () => ({ updated: 2 }));
    const createRun = vi.fn(async ({ engine_id, sample_count }) => ({
      id: `run-${engine_id}`,
      status: "pending",
      engine_status: "pending",
      parse_status: "pending",
      score_status: "pending",
      sample_count,
      triggered_by: "user",
      error_message: null,
      answers_expected: 0,
      answers_completed: 0,
      parse_completed: 0,
      score_completed: 0,
      started_at: null,
      completed_at: null,
      engine_started_at: null,
      engine_completed_at: null,
      parse_started_at: null,
      parse_completed_at: null,
      score_started_at: null,
      score_completed_at: null,
      query_set_id: "query-set-1",
      engine_id,
      project_id: "project-1",
      created_at: "2025-01-01T00:00:00Z",
    }));

    const result = await startFirstRun(
      {
        products: [],
        competitors: [],
        existingQuerySets: [],
        selectedEngineIds: ["engine-1", "engine-2"],
        sampleCount: DEFAULT_STARTER_SAMPLE_COUNT,
      },
      {
        saveProduct: async () => undefined,
        saveCompetitor: async () => undefined,
        createQuerySet,
        listQueries,
        generateQueries,
        approveQueries,
        createRun,
      },
    );

    expect(createQuerySet).toHaveBeenCalledWith({
      name: STARTER_QUERY_SET_NAME,
      description: "Starter AI visibility queries generated during onboarding.",
    });
    expect(generateQueries).toHaveBeenCalledWith("query-set-1", {
      count: STARTER_QUERY_COUNT,
    });
    expect(approveQueries).toHaveBeenCalledWith("query-set-1", ["query-1", "query-2"]);
    expect(createRun).toHaveBeenCalledTimes(2);
    expect(result.runs).toHaveLength(2);
    expect(result.failures).toHaveLength(0);
  });

  it("keeps successful runs when another engine launch fails", async () => {
    const createRun = vi.fn(async ({ engine_id }) => {
      if (engine_id === "engine-bad") {
        throw new Error("boom");
      }

      return {
        id: "run-good",
        status: "pending",
        engine_status: "pending",
        parse_status: "pending",
        score_status: "pending",
        sample_count: 2,
        triggered_by: "user",
        error_message: null,
        answers_expected: 0,
        answers_completed: 0,
        parse_completed: 0,
        score_completed: 0,
        started_at: null,
        completed_at: null,
        engine_started_at: null,
        engine_completed_at: null,
        parse_started_at: null,
        parse_completed_at: null,
        score_started_at: null,
        score_completed_at: null,
        query_set_id: "query-set-1",
        engine_id,
        project_id: "project-1",
        created_at: "2025-01-01T00:00:00Z",
      };
    });

    const result = await startFirstRun(
      {
        products: [],
        competitors: [],
        existingQuerySets: [
          {
            id: "query-set-1",
            name: STARTER_QUERY_SET_NAME,
            description: "",
            project_id: "project-1",
            query_count: 1,
            created_at: "2025-01-01T00:00:00Z",
          },
        ],
        selectedEngineIds: ["engine-good", "engine-bad"],
        sampleCount: DEFAULT_STARTER_SAMPLE_COUNT,
      },
      {
        saveProduct: async () => undefined,
        saveCompetitor: async () => undefined,
        createQuerySet: vi.fn(),
        listQueries: async () => [
          {
            id: "query-1",
            text: "sample query",
            category: "commercial",
            priority: 3,
            status: "approved",
            query_set_id: "query-set-1",
            cluster_id: null,
            created_at: "2025-01-01T00:00:00Z",
          },
        ],
        generateQueries: vi.fn(),
        approveQueries: vi.fn(async () => ({ updated: 0 })),
        createRun,
      },
    );

    expect(result.runs).toHaveLength(1);
    expect(result.failures).toEqual([
      {
        engineId: "engine-bad",
        error: expect.any(Error),
      },
    ]);
  });
});
