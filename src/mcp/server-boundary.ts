export interface McpServerOptions {
  readonly target?: string;
  readonly readOnly: boolean;
}

export function describeMcpBoundary(options: McpServerOptions): string {
  return options.target === undefined ? "read-only inspector MCP server" : `bound MCP server for ${options.target}`;
}
