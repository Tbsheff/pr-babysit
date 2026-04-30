import { execFileSync } from "node:child_process";

import { BabysitError } from "../core/errors.js";

export interface GitBaseline {
  readonly upstreamSha: string;
  readonly preRunHeadSha: string;
  readonly preRunStatus: readonly GitStatusEntry[];
}

export interface GitStatusEntry {
  readonly status: string;
  readonly path: string;
}

export function gitOutput(args: readonly string[], cwd = process.cwd()): string {
  return execFileSync("git", args, { cwd, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] }).trim();
}

export function assertGitWorktree(cwd = process.cwd()): void {
  try {
    gitOutput(["rev-parse", "--is-inside-work-tree"], cwd);
  } catch {
    throw new BabysitError("not_git_worktree", "watch must run from inside a git worktree.");
  }
}

export function captureGitBaseline(cwd = process.cwd()): GitBaseline {
  assertGitWorktree(cwd);
  const upstream = gitOutput(["rev-parse", "--abbrev-ref", "--symbolic-full-name", "@{upstream}"], cwd);
  if (upstream.length === 0) {
    throw new BabysitError("missing_upstream", "Current branch has no upstream.");
  }
  return {
    upstreamSha: gitOutput(["rev-parse", upstream], cwd),
    preRunHeadSha: gitOutput(["rev-parse", "HEAD"], cwd),
    preRunStatus: gitStatusEntries(cwd)
  };
}

export function gitStatusEntries(cwd = process.cwd()): readonly GitStatusEntry[] {
  const raw = execFileSync("git", ["status", "--porcelain=v1", "-z"], {
    cwd,
    encoding: "buffer",
    stdio: ["ignore", "pipe", "pipe"]
  });
  return parsePorcelainStatus(raw.toString("utf8"));
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

export function hasHeadAdvanced(baseline: GitBaseline, cwd = process.cwd()): boolean {
  return gitOutput(["rev-parse", "HEAD"], cwd) !== baseline.preRunHeadSha;
}

function parsePorcelainStatus(raw: string): readonly GitStatusEntry[] {
  const fields = raw.split("\0").filter((field) => field.length > 0);
  const entries: GitStatusEntry[] = [];

  for (let index = 0; index < fields.length; index += 1) {
    const field = fields[index];
    if (field === undefined || field.length < 4) {
      continue;
    }

    const status = field.slice(0, 2);
    const filePath = field.slice(3);
    entries.push({ status, path: filePath });

    if (status.includes("R") || status.includes("C")) {
      index += 1;
    }
  }

  return entries;
}
