import { mkdtemp, readFile, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

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

  test("watch fixture mode drains deliveries through the loop", async () => {
    const result = await runCliForTest(
      ["watch", target, "--fixture", "testdata/fixtures/review-comment-created.fixture.json"],
      services()
    );

    expect(result.code).toBe(0);
    expect(JSON.parse(result.stdout)).toMatchObject({
      ok: true,
      mode: "fixture",
      deliveries: 1,
      runs: [
        {
          runReason: "events",
          deliveryIds: ["delivery-1"],
          triggers: [expect.objectContaining({ event: "pull_request_review_comment" })]
        }
      ]
    });
  });

  test("installs bundled global skills for Codex and Claude", async () => {
    const tempDir = await mkdtemp(path.join(os.tmpdir(), "pr-babysit-skills-"));
    const originalCodexHome = process.env["CODEX_HOME"];
    const originalClaudeHome = process.env["CLAUDE_HOME"];
    process.env["CODEX_HOME"] = path.join(tempDir, "codex");
    process.env["CLAUDE_HOME"] = path.join(tempDir, "claude");

    try {
      const result = await runCliForTest(["skills", "install"]);
      expect(result.code).toBe(0);
      expect(JSON.parse(result.stdout)).toMatchObject({
        ok: true,
        installed: [
          { target: "codex", directory: path.join(tempDir, "codex", "skills", "babysit") },
          { target: "claude", directory: path.join(tempDir, "claude", "skills", "babysit") }
        ]
      });

      await expect(readFile(path.join(tempDir, "codex", "skills", "babysit", "SKILL.md"), "utf8")).resolves.toContain(
        "name: babysit"
      );
      await expect(readFile(path.join(tempDir, "claude", "skills", "babysit", "agents", "openai.yaml"), "utf8")).resolves.toContain(
        "Babysit PR"
      );
    } finally {
      restoreCodexHome(originalCodexHome);
      restoreClaudeHome(originalClaudeHome);
      await rm(tempDir, { force: true, recursive: true });
    }
  });
});

function restoreCodexHome(value: string | undefined): void {
  if (value === undefined) {
    delete process.env["CODEX_HOME"];
    return;
  }

  process.env["CODEX_HOME"] = value;
}

function restoreClaudeHome(value: string | undefined): void {
  if (value === undefined) {
    delete process.env["CLAUDE_HOME"];
    return;
  }

  process.env["CLAUDE_HOME"] = value;
}
