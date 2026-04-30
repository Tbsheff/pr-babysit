export function formatHelp(): string {
  return `pr-babysit

Usage:
  pr-babysit --help
  pr-babysit pr context [OWNER/REPO#NUMBER]
  pr-babysit watch [OWNER/REPO#NUMBER]
  pr-babysit reviews list OWNER/REPO#NUMBER --json
  pr-babysit reviews reply OWNER/REPO#NUMBER THREAD_ID --expected-head SHA --body "..."
  pr-babysit reviews reply-and-resolve OWNER/REPO#NUMBER THREAD_ID --expected-head SHA --body "..."
  pr-babysit reviews mark-false-positive OWNER/REPO#NUMBER THREAD_ID --expected-head SHA --reason "..."
  pr-babysit comments list OWNER/REPO#NUMBER --json
  pr-babysit comments add OWNER/REPO#NUMBER --expected-head SHA --body "..."
  pr-babysit checks list OWNER/REPO#NUMBER --json
  pr-babysit mcp [--target OWNER/REPO#NUMBER]
  pr-babysit skills install [--target all|codex|claude]
  pr-babysit setup secret [--force]

Current build:
  GitHub review core, CLI JSON commands, MCP stdio tools, fixture watch mode,
  webhook utilities, runner prompts, and git guardrails are available.
`;
}
