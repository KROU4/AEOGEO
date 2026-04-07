import type { ProductCreate, CompetitorCreate } from "@/types/brand";
import type { Query, QuerySet, QueryGenerateRequest } from "@/types/query";
import type { EngineRun, RunCreate } from "@/types/run";

export const STARTER_QUERY_SET_NAME = "Starter Visibility Queries";
export const STARTER_QUERY_SET_DESCRIPTION =
  "Starter AI visibility queries generated during onboarding.";
export const STARTER_QUERY_COUNT = 10;
export const DEFAULT_STARTER_SAMPLE_COUNT = 2;

type QuerySetInput = {
  name: string;
  description?: string;
};

type SaveCatalogFns = {
  saveProduct: (product: ProductCreate) => Promise<void>;
  saveCompetitor: (competitor: CompetitorCreate) => Promise<void>;
};

export type GenerateQueriesFns = SaveCatalogFns & {
  createQuerySet: (data: QuerySetInput) => Promise<QuerySet>;
  listQueries: (querySetId: string) => Promise<Query[]>;
  generateQueries: (
    querySetId: string,
    data: QueryGenerateRequest,
  ) => Promise<{ generated: number; queries: Query[] }>;
};

export type LaunchRunsFns = {
  approveQueries: (
    querySetId: string,
    queryIds: string[],
  ) => Promise<{ updated: number }>;
  createRun: (data: RunCreate) => Promise<EngineRun>;
};

export type StartFirstRunFns = SaveCatalogFns &
  GenerateQueriesFns &
  LaunchRunsFns;

export type GenerateQueriesInput = {
  products: ProductCreate[];
  competitors: CompetitorCreate[];
  existingQuerySets: QuerySet[];
};

export type GenerateQueriesResult = {
  querySet: QuerySet;
  queries: Query[];
};

export type LaunchRunsInput = {
  querySet: QuerySet;
  queries: Query[];
  selectedEngineIds: string[];
  sampleCount: number;
};

export type StartFirstRunInput = {
  products: ProductCreate[];
  competitors: CompetitorCreate[];
  existingQuerySets: QuerySet[];
  selectedEngineIds: string[];
  sampleCount: number;
};

export type RunLaunchFailure = {
  engineId: string;
  error: unknown;
};

export type StartFirstRunResult = {
  querySet: QuerySet;
  queries: Query[];
  runs: EngineRun[];
  failures: RunLaunchFailure[];
};

function findStarterQuerySet(querySets: QuerySet[]): QuerySet | undefined {
  return querySets.find((querySet) => querySet.name === STARTER_QUERY_SET_NAME);
}

function clampSampleCount(sampleCount: number): number {
  return Math.max(1, Math.min(10, Math.round(sampleCount)));
}

async function saveCatalog(
  products: ProductCreate[],
  competitors: CompetitorCreate[],
  fns: SaveCatalogFns,
): Promise<void> {
  for (const product of products.filter((item) => item.name.trim())) {
    await fns.saveProduct(product);
  }

  for (const competitor of competitors.filter((item) => item.name.trim())) {
    await fns.saveCompetitor(competitor);
  }
}

export async function finishSetupLater(
  products: ProductCreate[],
  competitors: CompetitorCreate[],
  fns: SaveCatalogFns,
): Promise<void> {
  await saveCatalog(products, competitors, fns);
}

/** Phase 1: Save catalog, create query set, generate queries. Does NOT approve or launch. */
export async function generateStarterQueries(
  input: GenerateQueriesInput,
  fns: GenerateQueriesFns,
): Promise<GenerateQueriesResult> {
  await saveCatalog(input.products, input.competitors, fns);

  let querySet = findStarterQuerySet(input.existingQuerySets);
  if (!querySet) {
    querySet = await fns.createQuerySet({
      name: STARTER_QUERY_SET_NAME,
      description: STARTER_QUERY_SET_DESCRIPTION,
    });
  }

  let queries = await fns.listQueries(querySet.id);
  if (queries.length === 0) {
    const generated = await fns.generateQueries(querySet.id, {
      count: STARTER_QUERY_COUNT,
    });
    queries = generated.queries;
  }

  return { querySet, queries };
}

/** Phase 2: Approve queries and launch engine runs. */
export async function launchRuns(
  input: LaunchRunsInput,
  fns: LaunchRunsFns,
): Promise<StartFirstRunResult> {
  let queries = [...input.queries];

  const queryIdsToApprove = queries
    .filter((query) => query.status !== "approved")
    .map((query) => query.id);

  if (queryIdsToApprove.length > 0) {
    await fns.approveQueries(input.querySet.id, queryIdsToApprove);
    queries = queries.map((query) =>
      queryIdsToApprove.includes(query.id)
        ? { ...query, status: "approved" }
        : query,
    );
  }

  const runs: EngineRun[] = [];
  const failures: RunLaunchFailure[] = [];

  for (const engineId of input.selectedEngineIds) {
    try {
      const run = await fns.createRun({
        query_set_id: input.querySet.id,
        engine_id: engineId,
        sample_count: clampSampleCount(input.sampleCount),
      });
      runs.push(run);
    } catch (error) {
      failures.push({ engineId, error });
    }
  }

  return { querySet: input.querySet, queries, runs, failures };
}

/** Legacy combined flow: generate + approve + launch in one shot. */
export async function startFirstRun(
  input: StartFirstRunInput,
  fns: StartFirstRunFns,
): Promise<StartFirstRunResult> {
  const { querySet, queries } = await generateStarterQueries(
    {
      products: input.products,
      competitors: input.competitors,
      existingQuerySets: input.existingQuerySets,
    },
    fns,
  );

  return launchRuns(
    {
      querySet,
      queries,
      selectedEngineIds: input.selectedEngineIds,
      sampleCount: input.sampleCount,
    },
    fns,
  );
}
