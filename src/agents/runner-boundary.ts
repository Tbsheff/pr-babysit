import type { PullRequestTarget } from "../core/ids.js";
import type { NormalizedTrigger } from "../webhooks/normalize.js";

export interface AgentRunInput {
  readonly runReason: "events" | "reconciliation";
  readonly target: PullRequestTarget;
  readonly expectedHeadSha: string;
  readonly triggers: readonly NormalizedTrigger[];
}

export interface AgentRunResult {
  readonly exitCode: number;
  readonly changedFiles: readonly string[];
}
