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
    expect(text).toContain("pr-babysit skills install");
  });
});
