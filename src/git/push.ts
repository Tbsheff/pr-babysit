import { execFileSync } from "node:child_process";

import type { GitBaseline } from "./status.js";
import { assertDescendantOfBaseline } from "./status.js";

export function pushBabysitCommits(baseline: GitBaseline, cwd = process.cwd()): void {
  assertDescendantOfBaseline(baseline, cwd);
  execFileSync("git", ["push"], { cwd, stdio: "pipe" });
}
