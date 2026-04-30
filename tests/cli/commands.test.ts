import { describe, expect, test } from "vitest";

import { GitHubReviewCore } from "../../src/core/github/review-core.js";
import { FakeGitHubReviewAdapter } from "../../src/core/github/fake-adapter.js";
import { parsePrTarget } from "../../src/cli/pr-target.js";
import { actor, headSha, prContext, reviewThread, target } from "../helpers/core-fixtures.js";
import { runCliForTest } from "../helpers/cli.js";
import { agentSafeCliCommands } from "../../src/cli/commands/agent-safe.js";

function services(): { readonly core: GitHubReviewCore; readonly adapter: FakeGitHubReviewAdapter } {
  const adapter = new FakeGitHubReviewAdapter({
    actor,
    contexts: { [target]: prContext() },
    threads: { [target]: [reviewThread()] },
    comments: { [target]: [] },
    checks: { [target]: [] }
  });
  return { core: new GitHubReviewCore(adapter), adapter };
}

describe("CLI commands", () => {
  test("parses PR targets", () => {
    expect(parsePrTarget("OWNER/REPO#123")).toBe(target);
    expect(parsePrTarget("https://github.com/OWNER/REPO/pull/123")).toBe(target);
    expect(parsePrTarget("nope")).toBeNull();
  });

  test("lists review threads as compact JSON", async () => {
    const result = await runCliForTest(["reviews", "list", target, "--json"], services());
    expect(result.code).toBe(0);
    expect(JSON.parse(result.stdout)).toMatchObject({ threads: [{ threadId: "review-thread:PRRT_1" }] });
  });

  test("preserves mutation envelopes and core error codes", async () => {
    const bundle = services();
    const result = await runCliForTest(
      ["reviews", "reply-and-resolve", target, "review-thread:PRRT_1", "--expected-head", headSha, "--body", "Fixed."],
      bundle
    );
    expect(result.code).toBe(0);
    expect(JSON.parse(result.stdout)).toMatchObject({ outcome: "mutated", replyState: "created", resolveState: "resolved" });

    const stale = await runCliForTest(
      ["reviews", "reply", target, "review-thread:PRRT_1", "--expected-head", "old", "--body", "Fixed."],
      bundle
    );
    expect(stale.code).toBe(1);
    expect(JSON.parse(stale.stderr)).toMatchObject({ ok: false, code: "stale_head" });
  });

  test("documents agent-safe command allowlist without bare resolve", () => {
    expect(agentSafeCliCommands).toContain("reviews mark-false-positive");
    expect(agentSafeCliCommands).not.toContain("reviews resolve");
  });
});
