import { describe, expect, test } from "vitest";

import { buildAgentPrompt } from "../../src/agents/prompt.js";
import { runLocalAgent, type CommandRunner } from "../../src/agents/runner.js";
import { headSha, target } from "../helpers/core-fixtures.js";

class FakeRunner implements CommandRunner {
  public command: string | null = null;
  public args: readonly string[] = [];

  public run(command: string, args: readonly string[]): Promise<number> {
    this.command = command;
    this.args = args;
    return Promise.resolve(0);
  }
}

describe("agent runner", () => {
  test("prompt excludes polling and bare resolve while advertising safe commands", () => {
    const prompt = buildAgentPrompt({ target, expectedHeadSha: headSha, runReason: "reconciliation", triggers: [] });
    expect(prompt).toContain("Do not poll GitHub");
    expect(prompt).toContain("pr-babysit reviews reply-and-resolve");
    expect(prompt).not.toContain("pr-babysit reviews resolve");
  });

  test("invokes through injectable command runner", async () => {
    const runner = new FakeRunner();
    const result = await runLocalAgent(
      { target, expectedHeadSha: headSha, runReason: "events", triggers: [] },
      { agent: "claude", runner }
    );
    expect(result.exitCode).toBe(0);
    expect(runner.command).toBe("claude");
    expect(runner.args).toContain("-p");
  });
});
