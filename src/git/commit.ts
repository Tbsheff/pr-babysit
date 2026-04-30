import { execFileSync } from "node:child_process";

import type { GitBaseline, GitStatusEntry } from "./status.js";
import { gitStatusEntries } from "./status.js";

export function commitBaselineChanges(
  baseline: GitBaseline,
  message = "fix: address PR review feedback",
  cwd = process.cwd()
): boolean {
  const changedPaths = changedSinceBaseline(baseline.preRunStatus, gitStatusEntries(cwd));
  if (changedPaths.length === 0) {
    return false;
  }

  execFileSync("git", ["add", "-A", "--", ...changedPaths], { cwd, stdio: "ignore" });
  execFileSync("git", ["commit", "-m", message, "--only", "--", ...changedPaths], { cwd, stdio: "ignore" });
  return true;
}

function changedSinceBaseline(
  baselineEntries: readonly GitStatusEntry[],
  currentEntries: readonly GitStatusEntry[]
): readonly string[] {
  const baseline = new Set(baselineEntries.map(statusKey));
  return [...new Set(currentEntries.filter((entry) => !baseline.has(statusKey(entry))).map((entry) => entry.path))];
}

function statusKey(entry: GitStatusEntry): string {
  return `${entry.status}\0${entry.path}`;
}
