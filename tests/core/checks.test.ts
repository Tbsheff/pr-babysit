import { describe, expect, test } from "vitest";

import { normalizeChecks } from "../../src/core/checks/normalize.js";

describe("check normalization", () => {
  test("normalizes, dedupes, and tie-breaks latest-head checks", () => {
    const checks = normalizeChecks(
      [
        {
          databaseId: 2,
          name: "typecheck",
          status: "completed",
          conclusion: "failure",
          url: "https://checks/2",
          createdAt: "2026-01-01T00:00:00Z",
          startedAt: "2026-01-01T00:01:00Z",
          completedAt: "2026-01-01T00:02:00Z",
          workflowName: "ci",
          appSlug: "actions"
        },
        {
          databaseId: 1,
          name: "typecheck",
          status: "completed",
          conclusion: "success",
          url: "https://checks/1",
          createdAt: "2026-01-01T00:00:00Z",
          startedAt: "2026-01-01T00:01:00Z",
          completedAt: "2026-01-01T00:02:00Z",
          workflowName: "ci",
          appSlug: "actions"
        }
      ],
      [{ sha: "abc", context: "lint", state: "error", targetUrl: null, createdAt: "2026-01-01T00:03:00Z" }]
    );

    expect(checks).toEqual([
      expect.objectContaining({ id: "check-run:1", kind: "check_run", conclusion: "success", lastObservedAt: "2026-01-01T00:02:00Z" }),
      expect.objectContaining({ id: "commit-status:abc:lint:2026-01-01T00:03:00Z", kind: "commit_status", conclusion: "failure" })
    ]);
  });
});
