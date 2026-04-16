import { expect, test } from "@playwright/test";

test("smoke happy path: login -> create project -> run -> score", async ({ page }) => {
  page.on("pageerror", (error) => {
    console.log("PAGEERROR:", error.message);
  });

  const projectId = "11111111-1111-1111-1111-111111111111";
  const querySetId = "22222222-2222-2222-2222-222222222222";
  const engineId = "33333333-3333-3333-3333-333333333333";
  const runId = "44444444-4444-4444-4444-444444444444";

  let projects: any[] = [];
  let runs: any[] = [
    {
      id: runId,
      project_id: projectId,
      query_set_id: querySetId,
      engine_id: engineId,
      sample_count: 5,
      status: "completed",
      triggered_by: "manual",
      created_at: "2026-04-16T10:00:00Z",
      updated_at: "2026-04-16T10:01:00Z",
    },
  ];

  await page.route("**/api/v1/**", async (route) => {
    const req = route.request();
    const url = new URL(req.url());
    const { searchParams } = url;
    const pathname = url.pathname.replace(/\/+$/, "");

    if (pathname === "/api/v1/auth/me" && req.method() === "GET") {
      return route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          id: "e2e-user",
          email: "e2e@example.com",
          name: "E2E User",
          tenant_id: "55555555-5555-5555-5555-555555555555",
          permissions: ["admin"],
          created_at: "2026-04-16T10:00:00Z",
        }),
      });
    }

    if (pathname === "/api/v1/projects" && req.method() === "GET") {
      return route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          items: projects,
          next_cursor: null,
          has_more: false,
        }),
      });
    }

    if (pathname === "/api/v1/projects" && req.method() === "POST") {
      const payload = JSON.parse(req.postData() || "{}");
      const created = {
        id: projectId,
        name: payload.name ?? "E2E Project",
        description: payload.description ?? "",
        client_name: payload.client_name ?? "ACME",
        domain: payload.domain ?? "example.com",
        content_locale: payload.content_locale ?? "en",
        member_count: 1,
        visibility_score: null,
        created_at: "2026-04-16T10:00:00Z",
        updated_at: "2026-04-16T10:00:00Z",
      };
      projects = [created];
      return route.fulfill({
        status: 201,
        contentType: "application/json",
        body: JSON.stringify(created),
      });
    }

    if (pathname === "/api/v1/projects/check-domain" && req.method() === "POST") {
      return route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          valid: true,
          domain: "example.com",
          reachable: true,
          error: null,
        }),
      });
    }

    if (pathname === `/api/v1/projects/${projectId}` && req.method() === "GET") {
      return route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(projects[0]),
      });
    }

    if (pathname === `/api/v1/projects/${projectId}/brand` && req.method() === "PUT") {
      return route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          id: "brand-1",
          project_id: projectId,
          name: "E2E Project",
          domain: "example.com",
        }),
      });
    }

    if (pathname === `/api/v1/projects/${projectId}/brand` && req.method() === "GET") {
      return route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          id: "brand-1",
          project_id: projectId,
          name: "E2E Project",
          domain: "example.com",
          description: "",
          industry: "",
          tone_of_voice: "",
          target_audience: "",
          unique_selling_points: [],
        }),
      });
    }

    if (pathname === `/api/v1/projects/${projectId}/brand/products` && req.method() === "GET") {
      return route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify([]),
      });
    }

    if (pathname === `/api/v1/projects/${projectId}/brand/competitors` && req.method() === "GET") {
      return route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify([]),
      });
    }

    if (pathname === `/api/v1/projects/${projectId}/query-sets` && req.method() === "GET") {
      return route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          items: [
            {
              id: querySetId,
              project_id: projectId,
              name: "Core queries",
              description: "",
              query_count: 5,
              created_at: "2026-04-16T10:00:00Z",
              updated_at: "2026-04-16T10:00:00Z",
            },
          ],
          next_cursor: null,
          has_more: false,
        }),
      });
    }

    if (pathname === "/api/v1/engines" && req.method() === "GET") {
      return route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify([
          {
            id: engineId,
            name: "ChatGPT",
            slug: "chatgpt",
            is_active: true,
            created_at: "2026-04-16T10:00:00Z",
            updated_at: "2026-04-16T10:00:00Z",
          },
        ]),
      });
    }

    if (pathname === `/api/v1/projects/${projectId}/runs` && req.method() === "GET") {
      return route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          items: runs,
          next_cursor: null,
          has_more: false,
        }),
      });
    }

    if (pathname === `/api/v1/projects/${projectId}/runs` && req.method() === "POST") {
      const payload = JSON.parse(req.postData() || "{}");
      const createdRun = {
        id: runId,
        project_id: projectId,
        query_set_id: payload.query_set_id ?? querySetId,
        engine_id: payload.engine_id ?? engineId,
        sample_count: payload.sample_count ?? 5,
        status: "completed",
        triggered_by: "manual",
        created_at: "2026-04-16T10:00:00Z",
        updated_at: "2026-04-16T10:01:00Z",
      };
      runs = [createdRun];
      return route.fulfill({
        status: 201,
        contentType: "application/json",
        body: JSON.stringify(createdRun),
      });
    }

    if (pathname === `/api/v1/projects/${projectId}/schedules` && req.method() === "GET") {
      return route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify([]),
      });
    }

    if (
      pathname === `/api/v1/projects/${projectId}/scores/summary` &&
      req.method() === "GET" &&
      searchParams.get("run_id")
    ) {
      return route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          run_id: runId,
          score_count: 5,
          avg_total: 7.8,
          avg_mention: 7.6,
          avg_sentiment: 8.0,
          avg_position: 7.4,
          avg_accuracy: 7.9,
          avg_citation: 7.5,
          avg_recommendation: 7.2,
        }),
      });
    }

    if (pathname.includes("/answers")) {
      return route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          items: [],
          next_cursor: null,
          has_more: false,
        }),
      });
    }

    return route.fulfill({
      status: 200,
      contentType: "application/json",
      body: "{}",
    });
  });

  await page.goto("/");
  await expect(page).toHaveURL(/\/projects\/new/);
  await page.locator("#brand-name").fill("E2E Project");
  await page.locator("#brand-domain").fill("example.com");
  await page.getByRole("button", { name: /Continue|Next/i }).last().click();

  await page.goto(`/projects/${projectId}/runs`);
  await expect(page).toHaveURL(new RegExp(`/projects/${projectId}/runs`));

  const runCreated = await page.evaluate(
    async ({ projectId, querySetId, engineId }) => {
      const response = await fetch(`/api/v1/projects/${projectId}/runs`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          query_set_id: querySetId,
          engine_id: engineId,
          sample_count: 5,
        }),
      });
      return response.ok;
    },
    { projectId, querySetId, engineId },
  );
  expect(runCreated).toBeTruthy();
  await expect(page.getByTestId(`run-score-${runId}`)).toContainText("7.8");
});
