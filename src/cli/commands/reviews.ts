import type { ReviewThreadId } from "../../core/ids.js";
import type { CliServices } from "../core-services.js";
import { hasFlag, readFlag, requireFlag } from "../args.js";
import { resolvePrTarget } from "../pr-target.js";

export async function runReviewsCommand(argv: readonly string[], services: CliServices): Promise<unknown> {
  const [subcommand] = argv;

  if (subcommand === "list") {
    const target = resolvePrTarget(argv[1]);
    const scope = readFlag(argv, "--scope") as "all" | "bots" | "humans" | undefined;
    const state = readFlag(argv, "--state") as "all" | "resolved" | "unresolved" | undefined;
    const filters: { scope?: "all" | "bots" | "humans"; state?: "all" | "resolved" | "unresolved" } = {};
    if (scope !== undefined) {
      filters.scope = scope;
    }
    if (state !== undefined) {
      filters.state = state;
    }
    const threads = await services.core.listReviewThreads(target, filters);
    return hasFlag(argv, "--json") ? { threads } : { ok: true, threads };
  }

  if (subcommand === "reply" || subcommand === "reply-and-resolve" || subcommand === "mark-false-positive") {
    const target = resolvePrTarget(argv[1]);
    const threadId = argv[2] as ReviewThreadId | undefined;
    if (threadId === undefined) {
      throw new Error("Missing thread id");
    }
    const expectedHeadSha = requireFlag(argv, "--expected-head");
    const body = subcommand === "mark-false-positive" ? requireFlag(argv, "--reason") : requireFlag(argv, "--body");
    const precondition = { target, expectedHeadSha };

    if (subcommand === "reply") {
      return await services.core.replyToThread(threadId, body, precondition);
    }
    if (subcommand === "reply-and-resolve") {
      return await services.core.replyAndResolve(threadId, body, precondition);
    }
    return await services.core.markFalsePositive(threadId, body, precondition);
  }

  if (subcommand === "resolve") {
    const target = resolvePrTarget(argv[1]);
    const threadId = argv[2] as ReviewThreadId | undefined;
    if (threadId === undefined) {
      throw new Error("Missing thread id");
    }
    return await services.core.resolveThread(threadId, target);
  }

  throw new Error(`Unknown reviews command: ${subcommand ?? ""}`);
}
