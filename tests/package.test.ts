import { readFile } from "node:fs/promises";
import { describe, expect, test } from "vitest";

describe("package manifest", () => {
  test("does not depend on agent-reviews", async () => {
    const text = await readFile("package.json", "utf8");
    expect(text).not.toContain("agent-reviews");
  });

  test("ships an npm-version-stable installer", async () => {
    const text = await readFile("scripts/install.sh", "utf8");
    expect(text).toContain("npm config get prefix");
    expect(text).not.toContain("npm bin");
    expect(text).toContain("pr-babysit setup secret");
    expect(text).toContain("pr-babysit skills install");
  });

  test("skill runs detached watch for current branch PR when no target is provided", async () => {
    const text = await readFile("skills/babysit/SKILL.md", "utf8");
    expect(text).toContain("babysit.wait_for_event");
    expect(text).toContain("Do not spawn nested agents when MCP event tools are available.");
    expect(text).toContain("pr-babysit watch \"$ARGUMENTS\" --detach");
    expect(text).toContain("pr-babysit watch --detach\nfi");
    expect(text).toContain("node dist/bin/pr-babysit.js watch --detach\nfi");
    expect(text).toContain("Do not run `pr-babysit watch \"\"`.");
    expect(text).toContain("Do not run foreground watch from the skill");
  });
});
