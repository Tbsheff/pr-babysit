import { BabysitError } from "../core/errors.js";
import type { PullRequestTarget } from "../core/ids.js";
import type { GitHubReviewCore } from "../core/github/review-core.js";
import { ensureSignedForwarderAvailable, startWebhookForwarder, type ForwarderProcess } from "./forwarder.js";
import { normalizeWebhookEvent } from "./normalize.js";
import { reconcileTarget } from "./reconcile.js";
import { requireWebhookSecret, startWebhookServer, type WebhookServer } from "./server.js";
import { WatchEventQueue } from "./event-queue.js";

export interface WatchRuntime {
  readonly target: PullRequestTarget;
  readonly startedAt: string;
  readonly queue: WatchEventQueue;
  readonly status: () => WatchRuntimeStatus;
  stop(): Promise<void>;
}

export interface WatchRuntimeStatus {
  readonly target: PullRequestTarget;
  readonly startedAt: string;
  readonly stopped: boolean;
  readonly pendingEvents: number;
}

export async function startWatchRuntime(core: GitHubReviewCore, target: PullRequestTarget): Promise<WatchRuntime> {
  const secret = requireWebhookSecret();
  ensureSignedForwarderAvailable();
  const context = await core.getPRContext(target);
  if (context.state !== "OPEN" || context.merged) {
    throw new BabysitError("unsupported_target_state", `${target} is not open.`);
  }
  if (context.isForkHead) {
    throw new BabysitError("fork_head_unsupported", "watch supports same-repo PR heads only in v1.");
  }

  const queue = new WatchEventQueue();
  const startedAt = new Date().toISOString();
  let stopped = false;
  let server: WebhookServer | null = null;
  let forwarder: ForwarderProcess | null = null;

  server = await startWebhookServer(8787, secret, (request) => {
    const parsed = JSON.parse(request.body) as Record<string, unknown>;
    const event = normalizeWebhookEvent(request.event, request.deliveryId, parsed);
    if (event.target !== target) {
      return;
    }
    if (event.decision === "terminate") {
      queue.enqueue({ kind: "terminate", target, deliveryIds: [request.deliveryId], triggers: [] });
      void stop();
      return;
    }
    if (event.decision === "ignore") {
      return;
    }
    if (event.decision === "reconcile") {
      queue.enqueue({ kind: "reconciliation", target, deliveryIds: [request.deliveryId], triggers: [] });
      return;
    }
    if (event.trigger !== null) {
      queue.enqueue({ kind: "events", target, deliveryIds: [request.deliveryId], triggers: [event.trigger] });
    }
  });
  forwarder = startWebhookForwarder(context.baseRepository.fullName, 8787, secret);

  const startupOutcome = await reconcileTarget(core, target);
  if (startupOutcome === "terminate") {
    queue.enqueue({ kind: "terminate", target, deliveryIds: [], triggers: [] });
    await stop();
  }
  if (startupOutcome === "run_agent") {
    queue.enqueue({ kind: "reconciliation", target, deliveryIds: [], triggers: [] });
  }

  async function stop(): Promise<void> {
    if (stopped) {
      return;
    }
    stopped = true;
    queue.close();
    await forwarder?.stop();
    await server?.close();
  }

  return {
    target,
    startedAt,
    queue,
    status(): WatchRuntimeStatus {
      return { target, startedAt, stopped, pendingEvents: queue.pendingCount };
    },
    stop
  };
}
