import { access } from "node:fs/promises";
import { constants } from "node:fs";
import { execFileSync } from "node:child_process";

import { BabysitError } from "../core/errors.js";

export type AgentKind = "auto" | "claude" | "codex";

export interface AgentCommand {
  readonly command: string;
  readonly args: readonly string[];
}

export function detectAgentCommand(kind: AgentKind, promptFile: string): AgentCommand {
  if (kind === "claude") {
    return { command: "claude", args: ["-p", "--file", promptFile] };
  }

  if (kind === "codex") {
    return { command: "codex", args: ["exec", "--file", promptFile] };
  }

  if (commandExists("claude")) {
    return detectAgentCommand("claude", promptFile);
  }
  if (commandExists("codex")) {
    return detectAgentCommand("codex", promptFile);
  }

  throw new BabysitError("not_found", "No local agent found. Install claude or codex, or pass --cmd.");
}

function commandExists(command: string): boolean {
  try {
    const resolved = execFileSync("which", [command], { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] }).trim();
    return resolved.length > 0;
  } catch {
    return false;
  }
}

export async function assertExecutable(path: string): Promise<void> {
  await access(path, constants.X_OK);
}
