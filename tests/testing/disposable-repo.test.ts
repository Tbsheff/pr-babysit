import { describe, expect, test } from "vitest";

import {
  advanceRemote,
  createDisposableGitRepo,
  detachHead,
  makeDirtyTree,
  makePushReject
} from "../../src/testing/git/disposable-repo.js";

describe("disposable git repo harness", () => {
  test("creates a repo with an upstream remote", async () => {
    const repo = await createDisposableGitRepo();
    try {
      expect(repo.run(["status", "--short"]).stdout).toBe("");
      expect(repo.run(["rev-parse", "--abbrev-ref", "--symbolic-full-name", "@{upstream}"]).stdout.trim()).toBe(
        "origin/main"
      );
    } finally {
      await repo.cleanup();
    }
  });

  test("models dirty tree, detached head, upstream drift, and push rejection", async () => {
    const repo = await createDisposableGitRepo();
    try {
      await makeDirtyTree(repo);
      expect(repo.run(["status", "--short"]).stdout).toContain("dirty.txt");

      repo.run(["add", "dirty.txt"]);
      repo.run(["commit", "-m", "chore: dirty baseline"]);
      await advanceRemote(repo);
      repo.run(["fetch", "origin", "main"]);
      expect(repo.run(["rev-list", "--count", "HEAD..origin/main"]).stdout.trim()).toBe("1");

      await makePushReject(repo);
      expect(() => repo.run(["push", "origin", "main"])).toThrow();

      detachHead(repo);
      expect(repo.run(["branch", "--show-current"]).stdout.trim()).toBe("");
    } finally {
      await repo.cleanup();
    }
  });
});
