import { mkdtemp, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import { describe, expect, test } from "vitest";

import { normalizeWebhookEvent } from "../../src/webhooks/normalize.js";
import { WatchLane } from "../../src/webhooks/lane.js";
import { signPayload, verifySignature } from "../../src/webhooks/signature.js";
import { requireWebhookSecret } from "../../src/webhooks/server.js";
import { reconcileTarget } from "../../src/webhooks/reconcile.js";
import { GitHubReviewCore } from "../../src/core/github/review-core.js";
import { FakeGitHubReviewAdapter } from "../../src/core/github/fake-adapter.js";
import { actor, prContext, reviewThread, target } from "../helpers/core-fixtures.js";

describe("webhook utilities", () => {
  test("verifies GitHub HMAC signatures", () => {
    const body = JSON.stringify({ ok: true });
    const signature = signPayload("secret", body);
    expect(verifySignature("secret", body, signature)).toBe(true);
    expect(verifySignature("secret", body, "sha256=bad")).toBe(false);
  });

  test("loads webhook secret from local config when env is unset", async () => {
    const tempDir = await mkdtemp(path.join(os.tmpdir(), "pr-babysit-secret-"));
    const envFile = path.join(tempDir, "env");
    await writeFile(envFile, "export PR_BABYSIT_WEBHOOK_SECRET=stored-secret\n", "utf8");

    try {
      expect(requireWebhookSecret({ PR_BABYSIT_ENV_FILE: envFile })).toBe("stored-secret");
      expect(requireWebhookSecret({ PR_BABYSIT_ENV_FILE: envFile, PR_BABYSIT_WEBHOOK_SECRET: "runtime-secret" })).toBe(
        "runtime-secret"
      );
    } finally {
      await rm(tempDir, { force: true, recursive: true });
    }
  });

  test("normalizes event matrix decisions", () => {
    const base = { repository: { full_name: "OWNER/REPO" }, pull_request: { number: 123, head: { sha: "abc" } } };
    expect(normalizeWebhookEvent("pull_request_review_comment", "d1", { ...base, action: "created" }).decision).toBe("agent");
    expect(normalizeWebhookEvent("pull_request", "d2", { ...base, action: "closed" }).decision).toBe("terminate");
    expect(normalizeWebhookEvent("check_run", "d3", { ...base, action: "completed" }).decision).toBe("reconcile");
  });

  test("dedupes delivery IDs while retaining distinct triggers", () => {
    const lane = new WatchLane(target);
    const event = normalizeWebhookEvent("pull_request_review_comment", "d1", {
      repository: { full_name: "OWNER/REPO" },
      pull_request: { number: 123 },
      action: "created"
    });
    expect(lane.enqueueDelivery("d1", event.trigger, false)).toBe(true);
    expect(lane.enqueueDelivery("d1", event.trigger, false)).toBe(false);
    expect(lane.consume()).toMatchObject({ deliveryIds: ["d1"], triggers: [expect.objectContaining({ event: "pull_request_review_comment" })] });
  });

  test("reconciles terminate, run_agent, and idle outcomes", async () => {
    const runAgent = new GitHubReviewCore(
      new FakeGitHubReviewAdapter({
        actor,
        contexts: { [target]: prContext() },
        threads: { [target]: [reviewThread()] },
        comments: { [target]: [] },
        checks: { [target]: [] }
      })
    );
    expect(await reconcileTarget(runAgent, target)).toBe("run_agent");

    const terminate = new GitHubReviewCore(
      new FakeGitHubReviewAdapter({
        actor,
        contexts: { [target]: prContext({ state: "CLOSED" }) },
        threads: { [target]: [] },
        comments: { [target]: [] },
        checks: { [target]: [] }
      })
    );
    expect(await reconcileTarget(terminate, target)).toBe("terminate");
  });
});
