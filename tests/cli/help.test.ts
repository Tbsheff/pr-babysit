import { spawnSync } from "node:child_process";
import path from "node:path";
import { describe, expect, test } from "vitest";

describe("pr-babysit CLI help", () => {
  test("runs through the TypeScript entrypoint", () => {
    const entrypoint = path.resolve("src/bin/pr-babysit.ts");
    const result = spawnSync("pnpm", ["exec", "tsx", entrypoint, "--help"], {
      encoding: "utf8"
    });

    expect(result.status).toBe(0);
    expect(result.stdout).toContain("Usage:");
    expect(result.stdout).toContain("pr-babysit watch");
  });
});
