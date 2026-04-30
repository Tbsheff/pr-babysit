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

  test("skill runs bare watch for current branch PR when no target is provided", async () => {
    const text = await readFile("skills/babysit/SKILL.md", "utf8");
    expect(text).toContain("pr-babysit watch \"$ARGUMENTS\"");
    expect(text).toContain("pr-babysit watch\nfi");
    expect(text).toContain("node dist/bin/pr-babysit.js watch\nfi");
    expect(text).toContain("Do not run `pr-babysit watch \"\"`.");
    expect(text).toContain("With no argument, run bare `pr-babysit watch`");
  });
});
