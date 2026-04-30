import { mkdtemp, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { spawn } from "node:child_process";

import type { AgentRunInput, AgentRunResult } from "./runner-boundary.js";
import { buildAgentPrompt } from "./prompt.js";
import { detectAgentCommand, type AgentKind } from "./commands.js";

export interface CommandRunner {
  run(command: string, args: readonly string[]): Promise<number>;
}

export class SubprocessCommandRunner implements CommandRunner {
  public async run(command: string, args: readonly string[]): Promise<number> {
    const child = spawn(command, args, { stdio: "inherit" });
    return new Promise((resolve, reject) => {
      child.once("error", reject);
      child.once("exit", (code) => {
        resolve(code ?? 1);
      });
    });
  }
}

export interface RunLocalAgentOptions {
  readonly agent: AgentKind;
  readonly runner: CommandRunner;
}

export async function runLocalAgent(input: AgentRunInput, options: RunLocalAgentOptions): Promise<AgentRunResult> {
  const dir = await mkdtemp(path.join(os.tmpdir(), "pr-babysit-agent-"));
  const promptFile = path.join(dir, "prompt.md");
  await writeFile(
    promptFile,
    buildAgentPrompt({
      target: input.target,
      expectedHeadSha: input.expectedHeadSha,
      runReason: input.runReason,
      triggers: input.triggers
    })
  );

  const command = detectAgentCommand(options.agent, promptFile);
  const exitCode = await options.runner.run(command.command, command.args);
  return { exitCode, changedFiles: [] };
}
