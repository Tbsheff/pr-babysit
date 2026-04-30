export function formatHelp(): string {
  return `pr-babysit

Usage:
  pr-babysit --help
  pr-babysit watch [OWNER/REPO#NUMBER]
  pr-babysit reviews list OWNER/REPO#NUMBER --json
  pr-babysit mcp [--target OWNER/REPO#NUMBER]

Current build:
  The scaffold is installed. GitHub review, MCP, webhook, and runner commands
  are implemented in later slices.
`;
}
