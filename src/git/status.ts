import { execFileSync } from "node:child_process";

import { BabysitError } from "../core/errors.js";

export interface GitBaseline {
  readonly upstreamSha: string;
  readonly preRunHeadSha: string;
}

export function gitOutput(args: readonly string[], cwd = process.cwd()): string {
  return execFileSync("git", args, { cwd, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] }).trim();
}

export function assertCleanWorktree(cwd = process.cwd()): void {
  try {
    gitOutput(["rev-parse", "--is-inside-work-tree"], cwd);
  } catch {
    throw new BabysitError("not_git_worktree", "watch must run from inside a git worktree.");
  }

  const status = gitOutput(["status", "--porcelain"], cwd);
  if (status.length > 0) {
    throw new BabysitError("dirty_worktree", "watch refuses to start on a dirty worktree.");
  }
}

export function captureGitBaseline(cwd = process.cwd()): GitBaseline {
  assertCleanWorktree(cwd);
  const upstream = gitOutput(["rev-parse", "--abbrev-ref", "--symbolic-full-name", "@{upstream}"], cwd);
  if (upstream.length === 0) {
    throw new BabysitError("missing_upstream", "Current branch has no upstream.");
  }
  return {
    upstreamSha: gitOutput(["rev-parse", upstream], cwd),
    preRunHeadSha: gitOutput(["rev-parse", "HEAD"], cwd)
  };
}

export function assertDescendantOfBaseline(baseline: GitBaseline, cwd = process.cwd()): void {
  const head = gitOutput(["rev-parse", "HEAD"], cwd);
  if (head === baseline.preRunHeadSha) {
    return;
  }
  const mergeBase = gitOutput(["merge-base", baseline.preRunHeadSha, "HEAD"], cwd);
  if (mergeBase !== baseline.preRunHeadSha) {
    throw new BabysitError("stale_head", "HEAD is not a descendant of the babysit baseline.");
  }
}
