import type { PullRequestTarget } from "../core/ids.js";
import type { NormalizedTrigger } from "./normalize.js";

export interface LaneSnapshot {
  readonly deliveryIds: readonly string[];
  readonly triggers: readonly NormalizedTrigger[];
  readonly reconcileRequested: boolean;
}

export class WatchLane {
  readonly #seenDeliveryIds = new Set<string>();
  readonly #pendingDeliveryIds = new Set<string>();
  readonly #pendingTriggers: NormalizedTrigger[] = [];
  #reconcileRequested = false;
  #terminated = false;

  public readonly target: PullRequestTarget;

  public constructor(target: PullRequestTarget) {
    this.target = target;
  }

  public enqueueDelivery(deliveryId: string, trigger: NormalizedTrigger | null, reconcileRequested: boolean): boolean {
    if (this.#seenDeliveryIds.has(deliveryId)) {
      return false;
    }

    this.#seenDeliveryIds.add(deliveryId);
    this.#pendingDeliveryIds.add(deliveryId);

    if (trigger !== null) {
      this.#pendingTriggers.push(trigger);
    }

    if (reconcileRequested) {
      this.#reconcileRequested = true;
    }

    return true;
  }

  public requestReconcile(): void {
    this.#reconcileRequested = true;
  }

  public terminate(): void {
    this.#terminated = true;
  }

  public get terminated(): boolean {
    return this.#terminated;
  }

  public get hasPendingWork(): boolean {
    return this.#pendingDeliveryIds.size > 0 || this.#pendingTriggers.length > 0 || this.#reconcileRequested;
  }

  public consume(): LaneSnapshot {
    const snapshot: LaneSnapshot = {
      deliveryIds: [...this.#pendingDeliveryIds],
      triggers: [...this.#pendingTriggers],
      reconcileRequested: this.#reconcileRequested
    };
    this.#pendingDeliveryIds.clear();
    this.#pendingTriggers.splice(0);
    this.#reconcileRequested = false;
    return snapshot;
  }
}
