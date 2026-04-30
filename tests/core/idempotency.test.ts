import { describe, expect, test } from "vitest";

import { appendIdempotencyMarker, containsBabysitMarker, createIdempotencyKey, normalizeMarkerBody } from "../../src/core/idempotency.js";

describe("idempotency markers", () => {
  test("normalizes CRLF and trailing whitespace before hashing", () => {
    const left = createIdempotencyKey({
      targetId: "review-thread:PRRT_1",
      action: "reply",
      expectedHeadSha: "abc",
      body: "Fixed.\r\nThanks.   "
    });
    const right = createIdempotencyKey({
      targetId: "review-thread:PRRT_1",
      action: "reply",
      expectedHeadSha: "abc",
      body: "Fixed.\nThanks."
    });

    expect(left).toBe(right);
    expect(normalizeMarkerBody("a  \r\nb\t")).toBe("a\nb");
    expect(containsBabysitMarker(appendIdempotencyMarker("Fixed.", left))).toBe(true);
  });
});
