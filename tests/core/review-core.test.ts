import { describe, expect, test } from "vitest";

import { BabysitError } from "../../src/core/errors.js";
import { FakeGitHubReviewAdapter } from "../../src/core/github/fake-adapter.js";
import { GitHubReviewCore } from "../../src/core/github/review-core.js";
import { appendIdempotencyMarker, createIdempotencyKey } from "../../src/core/idempotency.js";
import { actor, headSha, issueComment, prContext, reviewThread, target } from "../helpers/core-fixtures.js";

describe("GitHubReviewCore", () => {
  test("replies before resolving with canonical mutation envelope", async () => {
    const adapter = new FakeGitHubReviewAdapter({
      actor,
      contexts: { [target]: prContext() },
      threads: { [target]: [reviewThread()] },
      comments: { [target]: [] },
      checks: { [target]: [] }
    });
    const core = new GitHubReviewCore(adapter);

    const result = await core.replyAndResolve("review-thread:PRRT_1", "Fixed.", { target, expectedHeadSha: headSha });

    expect(result).toMatchObject({ outcome: "mutated", replyState: "created", resolveState: "resolved", mutated: true });
    expect(adapter.threadReplies).toHaveLength(1);
    expect(adapter.resolvedThreads).toEqual(["review-thread:PRRT_1"]);
    expect(adapter.threadReplies[0]?.body).toContain("pr-babysit:id=v1:");
  });

  test("stale head aborts before mutation", async () => {
    const adapter = new FakeGitHubReviewAdapter({
      actor,
      contexts: { [target]: prContext({ headSha: "new" }) },
      threads: { [target]: [reviewThread()] },
      comments: { [target]: [] },
      checks: { [target]: [] }
    });
    const core = new GitHubReviewCore(adapter);

    await expect(core.replyToThread("review-thread:PRRT_1", "Fixed.", { target, expectedHeadSha: "old" })).rejects.toMatchObject({
      code: "stale_head"
    } satisfies Partial<BabysitError>);
    expect(adapter.threadReplies).toHaveLength(0);
  });

  test("dedupes top-level PR comments by target/head/body intent", async () => {
    const key = createIdempotencyKey({ targetId: target, action: "comment", expectedHeadSha: headSha, body: "Done." });
    const existingBody = appendIdempotencyMarker("Done.", key);
    const adapter = new FakeGitHubReviewAdapter({
      actor,
      contexts: { [target]: prContext() },
      threads: { [target]: [] },
      comments: { [target]: [issueComment({ body: existingBody })] },
      checks: { [target]: [] }
    });
    const core = new GitHubReviewCore(adapter);

    const result = await core.addPrConversationComment(target, "Done.", headSha);

    expect(result.outcome).toBe("noop");
    expect(adapter.issueComments).toHaveLength(0);
  });
});
