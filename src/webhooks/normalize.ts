import type { PullRequestTarget } from "../core/ids.js";
import { parsePrTarget } from "../cli/pr-target.js";

export type WatchDecision = "agent" | "reconcile" | "terminate" | "ignore";

export interface NormalizedTrigger {
  readonly event: string;
  readonly action: string;
  readonly deliveryId: string;
  readonly repo: string;
  readonly pr: number;
  readonly headSha?: string;
  readonly reviewThreadId?: string;
  readonly reviewCommentId?: string;
  readonly issueCommentId?: string;
  readonly author?: string;
  readonly isBot?: boolean;
  readonly body?: string;
}

export interface NormalizedEvent {
  readonly target: PullRequestTarget | null;
  readonly decision: WatchDecision;
  readonly trigger: NormalizedTrigger | null;
  readonly diagnostic: string | null;
}

interface PayloadShape {
  readonly action?: string;
  readonly repository?: { readonly full_name?: string };
  readonly pull_request?: { readonly number?: number; readonly merged?: boolean; readonly head?: { readonly sha?: string } };
  readonly issue?: { readonly number?: number; readonly pull_request?: unknown };
  readonly comment?: { readonly id?: number; readonly body?: string; readonly user?: { readonly login?: string; readonly type?: string } };
}

export function normalizeWebhookEvent(event: string, deliveryId: string, payload: PayloadShape): NormalizedEvent {
  const repo = payload.repository?.full_name;
  const prNumber = payload.pull_request?.number ?? (payload.issue?.pull_request === undefined ? undefined : payload.issue.number);

  if (repo === undefined || prNumber === undefined) {
    return { target: null, decision: "ignore", trigger: null, diagnostic: "missing target mapping" };
  }

  const target = parsePrTarget(`${repo}#${prNumber}`);
  const action = payload.action ?? "";
  if (target === null) {
    return { target: null, decision: "ignore", trigger: null, diagnostic: "invalid target" };
  }

  if (event === "pull_request" && action === "closed") {
    return { target, decision: "terminate", trigger: null, diagnostic: payload.pull_request?.merged ? "merged" : "closed" };
  }

  const trigger: NormalizedTrigger = {
    event,
    action,
    deliveryId,
    repo,
    pr: prNumber,
    ...(payload.pull_request?.head?.sha === undefined ? {} : { headSha: payload.pull_request.head.sha }),
    ...(payload.comment?.id === undefined ? {} : { issueCommentId: `issue-comment:${payload.comment.id}` }),
    ...(payload.comment?.user?.login === undefined ? {} : { author: payload.comment.user.login }),
    ...(payload.comment?.user === undefined
      ? {}
      : { isBot: payload.comment.user.type === "Bot" || payload.comment.user.login?.endsWith("[bot]") === true }),
    ...(payload.comment?.body === undefined ? {} : { body: payload.comment.body })
  };

  if (event === "pull_request_review" || event === "pull_request_review_comment") {
    return { target, decision: "agent", trigger, diagnostic: null };
  }
  if (event === "issue_comment" && (action === "created" || action === "edited")) {
    return { target, decision: "agent", trigger, diagnostic: null };
  }
  if (event === "issue_comment" && action === "deleted") {
    return { target, decision: "reconcile", trigger: null, diagnostic: null };
  }
  if (event === "pull_request_review_thread" || event === "check_run" || event === "check_suite" || event === "workflow_run" || event === "status") {
    return { target, decision: "reconcile", trigger: null, diagnostic: null };
  }
  if (event === "pull_request") {
    return { target, decision: "reconcile", trigger: null, diagnostic: null };
  }

  return { target, decision: "ignore", trigger: null, diagnostic: "unsupported event" };
}
