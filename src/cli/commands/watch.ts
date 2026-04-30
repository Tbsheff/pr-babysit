import { BabysitError } from "../../core/errors.js";
import type { CliServices } from "../core-services.js";
import { readFlag } from "../args.js";
import { resolvePrTarget } from "../pr-target.js";
import { requireWebhookSecret, startWebhookServer } from "../../webhooks/server.js";
import { normalizeWebhookEvent } from "../../webhooks/normalize.js";
import { WatchLane } from "../../webhooks/lane.js";
import { WatchProcessor, type WatchLoopRunner, type WatchRunInput } from "../../webhooks/loop.js";
import { reconcileTarget, type ReconciliationOutcome } from "../../webhooks/reconcile.js";
import { ensureSignedForwarderAvailable, startWebhookForwarder } from "../../webhooks/forwarder.js";
import { loadReplayFixture } from "../../testing/fixtures/replay-fixture.js";
import { captureGitBaseline, type GitBaseline } from "../../git/status.js";
import { commitAll } from "../../git/commit.js";
import { pushBabysitCommits } from "../../git/push.js";
import { runLocalAgent, ShellCommandRunner, SubprocessCommandRunner } from "../../agents/runner.js";
import type { AgentKind } from "../../agents/commands.js";
import type { PullRequestTarget } from "../../core/ids.js";
import { parsePullRequestTarget } from "../../core/ids.js";

export async function runWatchCommand(argv: readonly string[], services: CliServices): Promise<unknown> {
  const fixture = readFlag(argv, "--fixture");
  const port = Number.parseInt(readFlag(argv, "--port") ?? "8787", 10);
  const agent = (readFlag(argv, "--agent") ?? "auto") as AgentKind;
  const cmd = readFlag(argv, "--cmd");
  const target = resolvePrTarget(argv[0]);

  if (fixture !== undefined) {
    return runFixtureWatch(fixture, target);
  }

  const secret = requireWebhookSecret();
  ensureSignedForwarderAvailable();
  const context = await services.core.getPRContext(target);
  if (context.state !== "OPEN" || context.merged) {
    throw new BabysitError("unsupported_target_state", `${target} is not open.`);
  }
  if (context.isForkHead) {
    throw new BabysitError("fork_head_unsupported", "watch supports same-repo PR heads only in v1.");
  }
  const baseline = captureGitBaseline();
  const lane = new WatchLane(target);
  const runner = new AgentWatchRunner({ services, baseline, agent, cmd });
  const processor = new WatchProcessor({
    lane,
    runner,
    reconcile: (): Promise<ReconciliationOutcome> => reconcileTarget(services.core, target)
  });
  lane.requestReconcile();
  await processor.drain();

  const server = await startWebhookServer(port, secret, (request) => {
    const parsed = JSON.parse(request.body) as Record<string, unknown>;
    const event = normalizeWebhookEvent(request.event, request.deliveryId, parsed);
    if (event.target !== target) {
      return;
    }
    if (event.decision === "terminate") {
      lane.terminate();
      return;
    }
    if (event.decision === "ignore") {
      return;
    }
    lane.enqueueDelivery(request.deliveryId, event.trigger, event.decision === "reconcile");
    void processor.drain();
  });
  const forwarder = startWebhookForwarder(context.baseRepository.fullName, port, secret);

  await waitForShutdown(lane, forwarder.child);
  await forwarder.stop();
  await server.close();
  return { ok: true, mode: "watch", target, headSha: context.headSha };
}

interface AgentWatchRunnerOptions {
  readonly services: CliServices;
  readonly baseline: GitBaseline;
  readonly agent: AgentKind;
  readonly cmd: string | undefined;
}

class AgentWatchRunner implements WatchLoopRunner {
  readonly #services: CliServices;
  readonly #baseline: GitBaseline;
  readonly #agent: AgentKind;
  readonly #cmd: string | undefined;

  public constructor(options: AgentWatchRunnerOptions) {
    this.#services = options.services;
    this.#baseline = options.baseline;
    this.#agent = options.agent;
    this.#cmd = options.cmd;
  }

  public async run(input: WatchRunInput): Promise<void> {
    const context = await this.#services.core.getPRContext(input.target);
    if (context.state !== "OPEN" || context.merged) {
      throw new BabysitError("unsupported_target_state", `${input.target} is not open.`);
    }

    const commandRunner = this.#cmd === undefined ? new SubprocessCommandRunner() : new ShellCommandRunner(this.#cmd);
    const result = await runLocalAgent(
      {
        runReason: input.runReason,
        target: input.target,
        expectedHeadSha: context.headSha,
        triggers: input.triggers
      },
      { agent: this.#agent, runner: commandRunner }
    );

    if (result.exitCode !== 0) {
      throw new BabysitError("network_failed", `Agent exited with code ${String(result.exitCode)}.`);
    }

    const committed = commitAll("fix: address PR review feedback");
    if (committed) {
      pushBabysitCommits(this.#baseline);
    }
  }
}

async function runFixtureWatch(fixturePath: string, target: PullRequestTarget): Promise<unknown> {
  const fixture = await loadReplayFixture(fixturePath);
  const lane = new WatchLane(target);
  const runs: WatchRunInput[] = [];
  const runner: WatchLoopRunner = {
    run(input: WatchRunInput): Promise<void> {
      runs.push(input);
      return Promise.resolve();
    }
  };
  const processor = new WatchProcessor({
    lane,
    runner,
    reconcile: (): Promise<ReconciliationOutcome> => {
      const startupKey = typeof fixture.startup === "string" ? fixture.startup : fixture.startup[0];
      if (startupKey === undefined) {
        return Promise.resolve("idle");
      }
      const startupSnapshot = fixture.snapshots[startupKey];
      return Promise.resolve(startupSnapshot !== undefined && startupSnapshot.threads.length > 0 ? "run_agent" : "idle");
    }
  });

  lane.requestReconcile();
  const parsedTarget = parsePullRequestTarget(target);
  if (parsedTarget === null) {
    throw new BabysitError("parse_failed", `Invalid target: ${target}`);
  }
  for (const delivery of fixture.deliveries) {
    const event = normalizeWebhookEvent(delivery.event, delivery.id, {
      repository: { full_name: `${parsedTarget.owner}/${parsedTarget.repo}` },
      pull_request: { number: parsedTarget.number },
      ...delivery.payload
    });
    lane.enqueueDelivery(delivery.id, event.trigger, event.decision === "reconcile");
  }
  await processor.drain();

  return { ok: true, mode: "fixture", target, deliveries: fixture.deliveries.length, runs };
}

async function waitForShutdown(lane: WatchLane, forwarder: NodeJS.EventEmitter): Promise<void> {
  await new Promise<void>((resolve, reject) => {
    const onSignal = (): void => {
      resolve();
    };
    process.once("SIGINT", onSignal);
    process.once("SIGTERM", onSignal);
    forwarder.once("exit", (code: number | null) => {
      if (lane.terminated) {
        resolve();
        return;
      }
      reject(new BabysitError("network_failed", `gh webhook forward exited with code ${String(code)}.`));
    });
  });
}
