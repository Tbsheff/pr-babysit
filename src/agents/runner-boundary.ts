export interface AgentRunInput {
  readonly runReason: "events" | "reconciliation";
  readonly target: string;
  readonly expectedHeadSha: string;
  readonly triggers: readonly unknown[];
}

export interface AgentRunResult {
  readonly exitCode: number;
  readonly changedFiles: readonly string[];
}
