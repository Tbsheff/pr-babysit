import type { PullRequestTarget } from "../core/ids.js";
import type { NormalizedTrigger } from "./normalize.js";
import type { ReconciliationOutcome } from "./reconcile.js";
import { WatchLane } from "./lane.js";

export interface WatchRunInput {
  readonly runReason: "events" | "reconciliation";
  readonly target: PullRequestTarget;
  readonly deliveryIds: readonly string[];
  readonly triggers: readonly NormalizedTrigger[];
}

export interface WatchLoopRunner {
  run(input: WatchRunInput): Promise<void>;
}

export interface WatchProcessorOptions {
  readonly lane: WatchLane;
  readonly reconcile: () => Promise<ReconciliationOutcome>;
  readonly runner: WatchLoopRunner;
}

export class WatchProcessor {
  readonly #lane: WatchLane;
  readonly #reconcile: () => Promise<ReconciliationOutcome>;
  readonly #runner: WatchLoopRunner;
  #running = false;

  public constructor(options: WatchProcessorOptions) {
    this.#lane = options.lane;
    this.#reconcile = options.reconcile;
    this.#runner = options.runner;
  }

  public async drain(): Promise<void> {
    if (this.#running) {
      return;
    }

    this.#running = true;
    try {
      while (!this.#lane.terminated && this.#lane.hasPendingWork) {
        await this.#processOnePass();
      }
    } finally {
      this.#running = false;
    }
  }

  async #processOnePass(): Promise<void> {
    const snapshot = this.#lane.consume();

    if (snapshot.triggers.length > 0) {
      await this.#runner.run({
        runReason: "events",
        target: this.#lane.target,
        deliveryIds: snapshot.deliveryIds,
        triggers: snapshot.triggers
      });
      return;
    }

    if (!snapshot.reconcileRequested) {
      return;
    }

    const outcome = await this.#reconcile();
    if (outcome === "terminate") {
      this.#lane.terminate();
      return;
    }

    if (outcome === "run_agent") {
      await this.#runner.run({
        runReason: "reconciliation",
        target: this.#lane.target,
        deliveryIds: snapshot.deliveryIds,
        triggers: []
      });
    }
  }
}
