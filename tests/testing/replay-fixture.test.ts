import { mkdtemp, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { describe, expect, test } from "vitest";

import { loadReplayFixture, SnapshotSequence } from "../../src/testing/fixtures/replay-fixture.js";

async function writeJson(filePath: string, value: object): Promise<void> {
  await writeFile(filePath, `${JSON.stringify(value, null, 2)}\n`);
}

describe("replay fixture loader", () => {
  test("loads inline payloads, payload paths, and ordered snapshot arrays", async () => {
    const dir = await mkdtemp(path.join(os.tmpdir(), "pr-babysit-fixture-"));
    const payloadPath = path.join(dir, "payload.json");
    const fixturePath = path.join(dir, "fixture.json");

    await writeJson(payloadPath, { action: "edited", body: "from file" });
    await writeJson(fixturePath, {
      target: { repo: "OWNER/REPO", number: 123 },
      startup: "startup-open",
      deliveries: [
        {
          id: "delivery-1",
          event: "pull_request_review_comment",
          headers: { "X-GitHub-Delivery": "delivery-1" },
          payload: { action: "created" },
          before: ["comment-created", "reply-present"],
          after: "reply-present"
        },
        {
          id: "delivery-2",
          event: "issue_comment",
          payloadPath: "payload.json",
          before: "reply-present"
        }
      ],
      snapshots: {
        "startup-open": { pr: { state: "OPEN" }, threads: [], comments: [], checks: [] },
        "comment-created": { pr: { state: "OPEN", step: "before" }, threads: [], comments: [], checks: [] },
        "reply-present": { pr: { state: "OPEN", step: "after" }, threads: [], comments: [], checks: [] }
      }
    });

    const fixture = await loadReplayFixture(fixturePath);

    expect(fixture.target).toEqual({ repo: "OWNER/REPO", number: 123 });
    expect(fixture.deliveries).toHaveLength(2);
    expect(fixture.deliveries[0]?.payload).toEqual({ action: "created" });
    expect(fixture.deliveries[1]?.payload).toEqual({ action: "edited", body: "from file" });

    const sequence = new SnapshotSequence(fixture.snapshots, fixture.deliveries[0]?.before ?? "startup-open");
    expect(sequence.next().pr).toEqual({ state: "OPEN", step: "before" });
    expect(sequence.next().pr).toEqual({ state: "OPEN", step: "after" });
    expect(sequence.next().pr).toEqual({ state: "OPEN", step: "after" });
  });

  test("rejects malformed fixture files", async () => {
    const dir = await mkdtemp(path.join(os.tmpdir(), "pr-babysit-bad-fixture-"));
    const fixturePath = path.join(dir, "fixture.json");

    await writeJson(fixturePath, {
      target: { repo: "not-a-repo", number: 0 },
      startup: "missing",
      deliveries: [],
      snapshots: {}
    });

    await expect(loadReplayFixture(fixturePath)).rejects.toThrow("target");
  });
});
