import { describe, expect, test } from "vitest";

import { captureGitBaseline, assertCleanWorktree, assertDescendantOfBaseline } from "../../src/git/status.js";
import { createDisposableGitRepo, makeDirtyTree } from "../../src/testing/git/disposable-repo.js";

describe("git safety guards", () => {
  test("refuses dirty worktrees and captures baseline push set", async () => {
    const repo = await createDisposableGitRepo();
    try {
      const baseline = captureGitBaseline(repo.root);
      expect(baseline.preRunHeadSha).toBeTruthy();
      expect(baseline.upstreamSha).toBeTruthy();

      await makeDirtyTree(repo);
      expect(() => {
        assertCleanWorktree(repo.root);
      }).toThrow("dirty worktree");
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
});
