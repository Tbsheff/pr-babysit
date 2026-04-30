import type {
  CheckRunId,
  CommitStatusId,
  IssueCommentId,
  PullRequestTarget,
  ReviewCommentId,
  ReviewThreadId
} from "./ids.js";

export interface ActorIdentity {
  readonly login: string;
  readonly id: string | null;
  readonly isBot: boolean;
}

export interface RepositoryRef {
  readonly owner: string;
  readonly name: string;
  readonly fullName: string;
}

export interface ChangedFile {
  readonly path: string;
  readonly additions: number;
  readonly deletions: number;
}

export interface PullRequestContext {
  readonly target: PullRequestTarget;
  readonly url: string;
  readonly state: "OPEN" | "CLOSED" | "MERGED";
  readonly merged: boolean;
  readonly headSha: string;
  readonly headRefName: string;
  readonly baseRefName: string;
  readonly isSameRepo: boolean;
  readonly isForkHead: boolean;
  readonly headRepository: RepositoryRef;
  readonly baseRepository: RepositoryRef;
  readonly author: ActorIdentity;
  readonly changedFiles: readonly ChangedFile[];
}

export interface ReviewThreadCapabilities {
  readonly canReply: boolean;
  readonly canResolve: boolean;
  readonly canUnresolve: boolean;
}

export interface ReviewThreadComment {
  readonly commentId: ReviewCommentId;
  readonly databaseId: number | null;
  readonly author: ActorIdentity;
  readonly authorAssociation: string;
  readonly body: string;
  readonly url: string;
  readonly createdAt: string;
  readonly containsBabysitMarker: boolean;
  readonly isAuthenticatedActor: boolean;
}

export interface ReviewThread {
  readonly threadId: ReviewThreadId;
  readonly isResolved: boolean;
  readonly isOutdated: boolean;
  readonly path: string;
  readonly line: number | null;
  readonly rootAuthor: string;
  readonly rootAuthorAssociation: string;
  readonly rootIsBot: boolean;
  readonly rootBody: string;
  readonly lastCommentAuthor: string;
  readonly lastCommentAuthorAssociation: string;
  readonly lastCommentIsBot: boolean;
  readonly lastCommentBody: string;
  readonly url: string;
  readonly commentIds: readonly ReviewCommentId[];
  readonly lastCommentId: ReviewCommentId;
  readonly capabilities: ReviewThreadCapabilities;
  readonly comments: readonly ReviewThreadComment[];
}

export interface IssueComment {
  readonly commentId: IssueCommentId;
  readonly author: ActorIdentity;
  readonly authorAssociation: string;
  readonly isBot: boolean;
  readonly isAuthenticatedActor: boolean;
  readonly body: string;
  readonly url: string;
  readonly createdAt: string;
  readonly updatedAt: string;
  readonly containsBabysitMarker: boolean;
}

export type NormalizedCheckStatus = "queued" | "in_progress" | "completed" | "unknown";
export type NormalizedCheckConclusion =
  | "success"
  | "failure"
  | "cancelled"
  | "skipped"
  | "timed_out"
  | "action_required"
  | "neutral"
  | "unknown"
  | null;

export interface NormalizedCheck {
  readonly id: CheckRunId | CommitStatusId;
  readonly kind: "check_run" | "commit_status";
  readonly source: string;
  readonly name: string;
  readonly status: NormalizedCheckStatus;
  readonly conclusion: NormalizedCheckConclusion;
  readonly url: string | null;
  readonly createdAt: string | null;
  readonly startedAt: string | null;
  readonly completedAt: string | null;
  readonly lastObservedAt: string | null;
}

export interface MutationPrecondition {
  readonly target: PullRequestTarget;
  readonly expectedHeadSha: string;
}

export type MutationOutcome = "mutated" | "noop" | "resumed" | "aborted" | "partial_mutation";
export type MutationStepState =
  | "not_applicable"
  | "created"
  | "already_present"
  | "resolved"
  | "already_resolved"
  | "skipped"
  | "failed";

export interface MutationResult {
  readonly targetId: string;
  readonly headSha: string;
  readonly outcome: MutationOutcome;
  readonly mutated: boolean;
  readonly idempotencyKey: string | null;
  readonly replyState: MutationStepState;
  readonly resolveState: MutationStepState;
  readonly commentState: MutationStepState;
  readonly url: string | null;
}
