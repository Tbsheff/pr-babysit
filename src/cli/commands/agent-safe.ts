export const agentSafeCliCommands = [
  "pr context",
  "reviews list",
  "reviews reply",
  "reviews reply-and-resolve",
  "reviews mark-false-positive",
  "comments list",
  "comments add",
  "checks list"
] as const;

export function isAgentSafeCliCommand(command: string): boolean {
  return agentSafeCliCommands.includes(command as (typeof agentSafeCliCommands)[number]);
}
