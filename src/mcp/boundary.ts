import { BabysitError } from "../core/errors.js";
import type { PullRequestTarget } from "../core/ids.js";

export interface McpBinding {
  readonly target: PullRequestTarget | undefined;
}

export function requireBoundTarget(binding: McpBinding, requestedTarget: PullRequestTarget | undefined): PullRequestTarget {
  if (binding.target === undefined) {
    throw new BabysitError("permission_denied", "Mutating MCP tools require --target bound mode.");
  }

  if (requestedTarget !== undefined && requestedTarget !== binding.target) {
    throw new BabysitError("permission_denied", `MCP server is bound to ${binding.target}.`);
  }

  return binding.target;
}
