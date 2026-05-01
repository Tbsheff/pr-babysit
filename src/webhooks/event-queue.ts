import type { PullRequestTarget } from "../core/ids.js";
import type { NormalizedTrigger } from "./normalize.js";

export type BabysitEventKind = "events" | "reconciliation" | "terminate";

export interface BabysitEvent {
  readonly id: string;
  readonly kind: BabysitEventKind;
  readonly target: PullRequestTarget;
  readonly deliveryIds: readonly string[];
  readonly triggers: readonly NormalizedTrigger[];
  readonly createdAt: string;
}

export interface WaitForEventResult {
  readonly timedOut: boolean;
  readonly event?: BabysitEvent;
}

interface WaitingConsumer {
  resolve(result: WaitForEventResult): void;
  timeout: NodeJS.Timeout;
}

export class WatchEventQueue {
  readonly #events: BabysitEvent[] = [];
  readonly #waiting: WaitingConsumer[] = [];
  #counter = 0;
  #closed = false;

  public enqueue(input: Omit<BabysitEvent, "id" | "createdAt">): BabysitEvent {
    this.#counter += 1;
    const event: BabysitEvent = {
      ...input,
      id: `event-${this.#counter.toString()}`,
      createdAt: new Date().toISOString()
    };

    const waiting = this.#waiting.shift();
    if (waiting !== undefined) {
      clearTimeout(waiting.timeout);
      waiting.resolve({ timedOut: false, event });
      return event;
    }

    this.#events.push(event);
    return event;
  }

  public wait(timeoutMs: number): Promise<WaitForEventResult> {
    const event = this.#events.shift();
    if (event !== undefined) {
      return Promise.resolve({ timedOut: false, event });
    }

    if (this.#closed) {
      return Promise.resolve({ timedOut: true });
    }

    return new Promise((resolve) => {
      const consumer: WaitingConsumer = {
        resolve,
        timeout: setTimeout(() => {
          const index = this.#waiting.indexOf(consumer);
          if (index !== -1) {
            this.#waiting.splice(index, 1);
          }
          resolve({ timedOut: true });
        }, timeoutMs)
      };
      this.#waiting.push(consumer);
    });
  }

  public close(): void {
    this.#closed = true;
    while (this.#waiting.length > 0) {
      const waiting = this.#waiting.shift();
      if (waiting !== undefined) {
        clearTimeout(waiting.timeout);
        waiting.resolve({ timedOut: true });
      }
    }
  }

  public get pendingCount(): number {
    return this.#events.length;
  }
}
