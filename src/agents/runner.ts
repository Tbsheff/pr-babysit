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

export class ShellCommandRunner implements CommandRunner {
  readonly #commandLine: string;

  public constructor(commandLine: string) {
    this.#commandLine = commandLine;
  }

  public async run(): Promise<number> {
    const child = spawn(this.#commandLine, { shell: true, stdio: "inherit" });
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
  const prompt = buildAgentPrompt({
    target: input.target,
    expectedHeadSha: input.expectedHeadSha,
    runReason: input.runReason,
    triggers: input.triggers
  });
  const command = detectAgentCommand(options.agent, prompt);
  const exitCode = await options.runner.run(command.command, command.args);
  return { exitCode, changedFiles: [] };
}
