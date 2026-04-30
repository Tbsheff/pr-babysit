import { readFile } from "node:fs/promises";
import { describe, expect, test } from "vitest";

describe("package manifest", () => {
  test("does not depend on agent-reviews", async () => {
    const text = await readFile("package.json", "utf8");
    expect(text).not.toContain("agent-reviews");
  });
});
