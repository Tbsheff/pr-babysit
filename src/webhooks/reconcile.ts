import type { GitHubReviewCore } from "../core/github/review-core.js";
import type { PullRequestTarget } from "../core/ids.js";

export type ReconciliationOutcome = "terminate" | "run_agent" | "idle";

export async function reconcileTarget(core: GitHubReviewCore, target: PullRequestTarget): Promise<ReconciliationOutcome> {
  const context = await core.getPRContext(target);
  if (context.state !== "OPEN" || context.merged) {
    return "terminate";
  }

  const [threads, checks] = await Promise.all([core.listReviewThreads(target, { state: "unresolved" }), core.listChecks(target)]);
  if (threads.length > 0) {
    return "run_agent";
  }

  if (checks.some((check) => ["failure", "cancelled", "timed_out", "action_required"].includes(check.conclusion ?? ""))) {
    return "run_agent";
  }

  return "idle";
}
