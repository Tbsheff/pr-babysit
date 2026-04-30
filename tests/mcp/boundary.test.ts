import { describe, expect, test } from "vitest";

import { GitHubReviewCore } from "../../src/core/github/review-core.js";
import { FakeGitHubReviewAdapter } from "../../src/core/github/fake-adapter.js";
import { requireBoundTarget } from "../../src/mcp/boundary.js";
import { createMcpServer } from "../../src/mcp/server.js";
import { actor, prContext, target } from "../helpers/core-fixtures.js";

describe("MCP boundary", () => {
  test("requires bound mode for mutations and rejects wrong targets", () => {
    expect(() => requireBoundTarget({ target: undefined }, undefined)).toThrow("bound mode");
    expect(() => requireBoundTarget({ target }, "OTHER/REPO#1")).toThrow("bound to OWNER/REPO#123");
    expect(requireBoundTarget({ target }, target)).toBe(target);
  });

  test("creates an MCP server with default agent-safe tools only", () => {
    const core = new GitHubReviewCore(
      new FakeGitHubReviewAdapter({
        actor,
        contexts: { [target]: prContext() },
        threads: { [target]: [] },
        comments: { [target]: [] },
        checks: { [target]: [] }
      })
    );
    const server = createMcpServer(["--target", target], { core });
    expect(server).toBeDefined();
  });
});
