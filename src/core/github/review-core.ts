import { BabysitError } from "../errors.js";
import {
  appendIdempotencyMarker,
  containsBabysitMarker,
  createIdempotencyKey,
  type IdempotencyInput
} from "../idempotency.js";
import type { PullRequestTarget, ReviewThreadId } from "../ids.js";
import type {
  ActorIdentity,
  IssueComment,
  MutationPrecondition,
  MutationResult,
  NormalizedCheck,
  PullRequestContext,
  ReviewThread
} from "../types.js";

export interface ThreadReply {
  readonly body: string;
  readonly url: string;
}

export interface CommentReply {
  readonly body: string;
  readonly url: string;
}

export interface GitHubReviewAdapter {
  getAuthenticatedActor(): Promise<ActorIdentity>;
  getPRContext(target: PullRequestTarget): Promise<PullRequestContext>;
  listReviewThreads(target: PullRequestTarget): Promise<readonly ReviewThread[]>;
  listIssueComments(target: PullRequestTarget): Promise<readonly IssueComment[]>;
  listChecks(target: PullRequestTarget): Promise<readonly NormalizedCheck[]>;
  addThreadReply(threadId: ReviewThreadId, body: string): Promise<ThreadReply>;
  resolveThread(threadId: ReviewThreadId): Promise<void>;
  addIssueComment(target: PullRequestTarget, body: string): Promise<CommentReply>;
}

export interface ReviewThreadFilters {
  readonly state?: "all" | "resolved" | "unresolved";
  readonly scope?: "all" | "bots" | "humans";
}

export class GitHubReviewCore {
  readonly #adapter: GitHubReviewAdapter;

  public constructor(adapter: GitHubReviewAdapter) {
    this.#adapter = adapter;
  }

  public getAuthenticatedActor(): Promise<ActorIdentity> {
    return this.#adapter.getAuthenticatedActor();
  }

  public getPRContext(target: PullRequestTarget): Promise<PullRequestContext> {
    return this.#adapter.getPRContext(target);
  }

  public async listReviewThreads(
    target: PullRequestTarget,
    filters: ReviewThreadFilters = {}
  ): Promise<readonly ReviewThread[]> {
    const threads = await this.#adapter.listReviewThreads(target);
    return threads.filter((thread) => matchesThreadFilters(thread, filters));
  }

  public listIssueComments(target: PullRequestTarget): Promise<readonly IssueComment[]> {
    return this.#adapter.listIssueComments(target);
  }

  public listChecks(target: PullRequestTarget): Promise<readonly NormalizedCheck[]> {
    return this.#adapter.listChecks(target);
  }

  public async replyToThread(threadId: ReviewThreadId, body: string, precondition: MutationPrecondition): Promise<MutationResult> {
    return this.#replyToThreadWithAction(threadId, body, precondition, "reply");
  }

  public async resolveThread(threadId: ReviewThreadId, target: PullRequestTarget): Promise<MutationResult> {
    const context = await this.#adapter.getPRContext(target);
    ensureOpenTarget(context);
    const thread = await this.#findThread(target, threadId);

    if (thread.isResolved) {
      return mutationEnvelope({
        targetId: threadId,
        headSha: context.headSha,
        outcome: "noop",
        mutated: false,
        idempotencyKey: null,
        replyState: "not_applicable",
        resolveState: "already_resolved",
        commentState: "not_applicable",
        url: thread.url
      });
    }

    await this.#adapter.resolveThread(threadId);
    return mutationEnvelope({
      targetId: threadId,
      headSha: context.headSha,
      outcome: "mutated",
      mutated: true,
      idempotencyKey: null,
      replyState: "not_applicable",
      resolveState: "resolved",
      commentState: "not_applicable",
      url: thread.url
    });
  }

  public async replyAndResolve(
    threadId: ReviewThreadId,
    body: string,
    precondition: MutationPrecondition
  ): Promise<MutationResult> {
    const reply = await this.#replyToThreadWithAction(threadId, body, precondition, "reply_and_resolve");

    if (reply.outcome === "aborted" || reply.outcome === "partial_mutation") {
      return reply;
    }

    const context = await this.#adapter.getPRContext(precondition.target);
    ensureExpectedHead(context, precondition.expectedHeadSha);
    const thread = await this.#findThread(precondition.target, threadId);

    if (thread.isResolved) {
      return mutationEnvelope({
        ...reply,
        outcome: reply.mutated ? "mutated" : "noop",
        resolveState: "already_resolved",
        url: reply.url ?? thread.url
      });
    }

    await this.#adapter.resolveThread(threadId);
    return mutationEnvelope({
      ...reply,
      outcome: reply.mutated ? "mutated" : "resumed",
      mutated: true,
      resolveState: "resolved",
      url: reply.url ?? thread.url
    });
  }

  public markFalsePositive(
    threadId: ReviewThreadId,
    reason: string,
    precondition: MutationPrecondition
  ): Promise<MutationResult> {
    return this.replyAndResolve(threadId, `False positive: ${reason}`, {
      target: precondition.target,
      expectedHeadSha: precondition.expectedHeadSha
    });
  }

  public async addPrConversationComment(
    target: PullRequestTarget,
    body: string,
    expectedHeadSha: string
  ): Promise<MutationResult> {
    const context = await this.#adapter.getPRContext(target);
    ensureExpectedHead(context, expectedHeadSha);
    const input = idempotencyInput(target, "comment", expectedHeadSha, body);
    const key = createIdempotencyKey(input);
    const comments = await this.#adapter.listIssueComments(target);
    const existing = comments.find((comment) => comment.body.includes(`pr-babysit:id=${key}`));

    if (existing !== undefined) {
      return mutationEnvelope({
        targetId: target,
        headSha: context.headSha,
        outcome: "noop",
        mutated: false,
        idempotencyKey: key,
        replyState: "not_applicable",
        resolveState: "not_applicable",
        commentState: "already_present",
        url: existing.url
      });
    }

    const comment = await this.#adapter.addIssueComment(target, appendIdempotencyMarker(body, key));
    return mutationEnvelope({
      targetId: target,
      headSha: context.headSha,
      outcome: "mutated",
      mutated: true,
      idempotencyKey: key,
      replyState: "not_applicable",
      resolveState: "not_applicable",
      commentState: "created",
      url: comment.url
    });
  }

  async #replyToThreadWithAction(
    threadId: ReviewThreadId,
    body: string,
    precondition: MutationPrecondition,
    action: string
  ): Promise<MutationResult> {
    const context = await this.#adapter.getPRContext(precondition.target);
    ensureExpectedHead(context, precondition.expectedHeadSha);
    const thread = await this.#findThread(precondition.target, threadId);

    if (!thread.capabilities.canReply) {
      throw new BabysitError("permission_denied", `Cannot reply to ${threadId}`);
    }

    const input = idempotencyInput(threadId, action, precondition.expectedHeadSha, body);
    const key = createIdempotencyKey(input);
    const existingReply = thread.comments.find((comment) => comment.body.includes(`pr-babysit:id=${key}`));

    if (existingReply !== undefined) {
      return mutationEnvelope({
        targetId: threadId,
        headSha: context.headSha,
        outcome: "noop",
        mutated: false,
        idempotencyKey: key,
        replyState: "already_present",
        resolveState: "not_applicable",
        commentState: "not_applicable",
        url: existingReply.url
      });
    }

    const reply = await this.#adapter.addThreadReply(threadId, appendIdempotencyMarker(body, key));
    return mutationEnvelope({
      targetId: threadId,
      headSha: context.headSha,
      outcome: "mutated",
      mutated: true,
      idempotencyKey: key,
      replyState: "created",
      resolveState: "not_applicable",
      commentState: "not_applicable",
      url: reply.url
    });
  }

  async #findThread(target: PullRequestTarget, threadId: ReviewThreadId): Promise<ReviewThread> {
    const thread = (await this.#adapter.listReviewThreads(target)).find((candidate) => candidate.threadId === threadId);
    if (thread === undefined) {
      throw new BabysitError("not_found", `Review thread not found: ${threadId}`);
    }
    return thread;
  }
}

function ensureOpenTarget(context: PullRequestContext): void {
  if (context.state !== "OPEN" || context.merged) {
    throw new BabysitError("unsupported_target_state", `${context.target} is not open`);
  }
}

function ensureExpectedHead(context: PullRequestContext, expectedHeadSha: string): void {
  ensureOpenTarget(context);
  if (context.headSha !== expectedHeadSha) {
    throw new BabysitError("stale_head", `Expected ${expectedHeadSha}, found ${context.headSha}`);
  }
}

function idempotencyInput(targetId: string, action: string, expectedHeadSha: string, body: string): IdempotencyInput {
  return { targetId, action, expectedHeadSha, body };
}

function mutationEnvelope(result: MutationResult): MutationResult {
  return result;
}

function matchesThreadFilters(thread: ReviewThread, filters: ReviewThreadFilters): boolean {
  if (filters.state === "resolved" && !thread.isResolved) {
    return false;
  }
  if (filters.state === "unresolved" && thread.isResolved) {
    return false;
  }
  if (filters.scope === "bots" && !thread.lastCommentIsBot) {
    return false;
  }
  if (filters.scope === "humans" && thread.lastCommentIsBot) {
    return false;
  }
  return true;
}

export function latestActionableThreadComment(thread: ReviewThread): string | null {
  const comment = [...thread.comments]
    .reverse()
    .find((candidate) => !candidate.isAuthenticatedActor && !containsBabysitMarker(candidate.body));
  return comment?.body ?? null;
}
