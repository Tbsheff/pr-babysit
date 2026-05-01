import { describe, expect, test } from "vitest";

import { WatchEventQueue } from "../../src/webhooks/event-queue.js";
import { target } from "../helpers/core-fixtures.js";

describe("watch event queue", () => {
  test("returns queued events immediately", async () => {
    const queue = new WatchEventQueue();
    const event = queue.enqueue({ kind: "reconciliation", target, deliveryIds: [], triggers: [] });

    await expect(queue.wait(100)).resolves.toMatchObject({ timedOut: false, event });
    expect(queue.pendingCount).toBe(0);
  });

  test("waits for future events without polling", async () => {
    const queue = new WatchEventQueue();
    const waiting = queue.wait(1000);
    const event = queue.enqueue({ kind: "events", target, deliveryIds: ["delivery-1"], triggers: [] });

    await expect(waiting).resolves.toMatchObject({ timedOut: false, event });
  });

  test("times out when no event arrives", async () => {
    const queue = new WatchEventQueue();
    await expect(queue.wait(1)).resolves.toMatchObject({ timedOut: true });
  });
});
