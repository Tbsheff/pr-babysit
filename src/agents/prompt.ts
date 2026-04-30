import type { PullRequestTarget } from "../core/ids.js";
import type { NormalizedTrigger } from "../webhooks/normalize.js";
import { agentSafeCliCommands } from "../cli/commands/agent-safe.js";

export interface AgentPromptInput {
  readonly target: PullRequestTarget;
  readonly expectedHeadSha: string;
  readonly runReason: "events" | "reconciliation";
  readonly triggers: readonly NormalizedTrigger[];
}

export function buildAgentPrompt(input: AgentPromptInput): string {
  return `You are babysitting ${input.target}.

Expected PR head SHA: ${input.expectedHeadSha}
Run reason: ${input.runReason}

Do not poll GitHub. Do not wait for future events. The outer pr-babysit event loop will call you again when GitHub sends another webhook.

Agent-safe CLI commands:
${agentSafeCliCommands.map((command) => `- pr-babysit ${command}`).join("\n")}

Do not use bare reviews resolve. Always reply before resolving review feedback.

Triggers:
${JSON.stringify(input.triggers, null, 2)}
`;
}
