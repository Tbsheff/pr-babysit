import { describe, expect, test } from "vitest";

import { commitBaselineChanges } from "../../src/git/commit.js";
import { captureGitBaseline, assertDescendantOfBaseline } from "../../src/git/status.js";
import { createDisposableGitRepo, makeDirtyTree } from "../../src/testing/git/disposable-repo.js";

describe("git safety guards", () => {
  test("captures baseline push set even with dirty worktrees", async () => {
    const repo = await createDisposableGitRepo();
    try {
      await makeDirtyTree(repo);
      const baseline = captureGitBaseline(repo.root);
      expect(baseline.preRunHeadSha).toBeTruthy();
      expect(baseline.upstreamSha).toBeTruthy();
      expect(baseline.preRunStatus).toContainEqual({ status: "??", path: "dirty.txt" });
    } finally {
      await repo.cleanup();
    }
  });

  test("allows strict descendants of the pre-run head", async () => {
    const repo = await createDisposableGitRepo();
    try {
      const baseline = captureGitBaseline(repo.root);
      await repo.write("change.txt", "change\n");
      repo.run(["add", "change.txt"]);
      repo.run(["commit", "-m", "fix: change"]);
      expect(() => {
        assertDescendantOfBaseline(baseline, repo.root);
      }).not.toThrow();
    } finally {
      await repo.cleanup();
    }
  });

  test("commits only changes that happened after a dirty baseline", async () => {
    const repo = await createDisposableGitRepo();
    try {
      await makeDirtyTree(repo);
      repo.run(["add", "dirty.txt"]);
      const baseline = captureGitBaseline(repo.root);

      await repo.write("agent.txt", "agent\n");
      expect(commitBaselineChanges(baseline, "fix: agent", repo.root)).toBe(true);

      expect(repo.run(["show", "--name-only", "--format=", "HEAD"]).stdout.trim()).toBe("agent.txt");
      expect(repo.run(["status", "--short"]).stdout).toContain("A  dirty.txt");
    } finally {
      await repo.cleanup();
    }
  });
});
