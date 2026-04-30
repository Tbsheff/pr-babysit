import { describe, expect, test } from "vitest";

import { WatchLane } from "../../src/webhooks/lane.js";
import { WatchProcessor, type WatchLoopRunner, type WatchRunInput } from "../../src/webhooks/loop.js";
import type { NormalizedTrigger } from "../../src/webhooks/normalize.js";
import { target } from "../helpers/core-fixtures.js";

function trigger(deliveryId: string, event = "pull_request_review_comment"): NormalizedTrigger {
  return {
    event,
    action: "created",
    deliveryId,
    repo: "OWNER/REPO",
    pr: 123
  };
}

class RecordingRunner implements WatchLoopRunner {
  readonly runs: WatchRunInput[] = [];
  public onRun: (() => void) | null = null;

  public run(input: WatchRunInput): Promise<void> {
    this.runs.push(input);
    this.onRun?.();
    return Promise.resolve();
  }
}

describe("WatchProcessor loop", () => {
  test("batches multiple event triggers into one agent run", async () => {
    const lane = new WatchLane(target);
    const runner = new RecordingRunner();
    const processor = new WatchProcessor({
      lane,
      runner,
      reconcile: (): Promise<"idle"> => Promise.resolve("idle")
    });

    lane.enqueueDelivery("d1", trigger("d1"), false);
    lane.enqueueDelivery("d2", trigger("d2", "issue_comment"), false);

    await processor.drain();

    expect(runner.runs).toHaveLength(1);
    expect(runner.runs[0]).toMatchObject({
      runReason: "events",
      deliveryIds: ["d1", "d2"],
      triggers: [{ deliveryId: "d1" }, { deliveryId: "d2" }]
    });
  });

  test("runs reconciliation-only agent pass when reconciliation finds work", async () => {
    const lane = new WatchLane(target);
    const runner = new RecordingRunner();
    const processor = new WatchProcessor({
      lane,
      runner,
      reconcile: (): Promise<"run_agent"> => Promise.resolve("run_agent")
    });

    lane.enqueueDelivery("d1", null, true);
    await processor.drain();

    expect(runner.runs).toEqual([
      expect.objectContaining({
        runReason: "reconciliation",
        deliveryIds: ["d1"],
        triggers: []
      })
    ]);
  });

  test("terminates the lane when reconciliation observes a closed PR", async () => {
    const lane = new WatchLane(target);
    const runner = new RecordingRunner();
    const processor = new WatchProcessor({
      lane,
      runner,
      reconcile: (): Promise<"terminate"> => Promise.resolve("terminate")
    });

    lane.requestReconcile();
    await processor.drain();

    expect(lane.terminated).toBe(true);
    expect(runner.runs).toHaveLength(0);
  });

  test("performs a follow-up pass for events that arrive while the runner is active", async () => {
    const lane = new WatchLane(target);
    const runner = new RecordingRunner();
    const processor = new WatchProcessor({
      lane,
      runner,
      reconcile: (): Promise<"idle"> => Promise.resolve("idle")
    });

    runner.onRun = (): void => {
      if (runner.runs.length === 1) {
        lane.enqueueDelivery("d2", trigger("d2", "issue_comment"), false);
      }
    };

    lane.enqueueDelivery("d1", trigger("d1"), false);
    await processor.drain();

    expect(runner.runs).toHaveLength(2);
    expect(runner.runs[0]?.deliveryIds).toEqual(["d1"]);
    expect(runner.runs[1]?.deliveryIds).toEqual(["d2"]);
  });

  test("does not duplicate a delivery id across loop passes", async () => {
    const lane = new WatchLane(target);
    const runner = new RecordingRunner();
    const processor = new WatchProcessor({
      lane,
      runner,
      reconcile: (): Promise<"idle"> => Promise.resolve("idle")
    });

    expect(lane.enqueueDelivery("d1", trigger("d1"), false)).toBe(true);
    await processor.drain();
    expect(lane.enqueueDelivery("d1", trigger("d1"), false)).toBe(false);
    await processor.drain();

    expect(runner.runs).toHaveLength(1);
  });
});
