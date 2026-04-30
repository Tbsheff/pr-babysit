export type PullRequestTarget = `${string}/${string}#${number}`;
export type ReviewThreadId = `review-thread:${string}`;
export type ReviewCommentId = `review-comment:${string}`;
export type IssueCommentId = `issue-comment:${number}`;
export type CheckRunId = `check-run:${number}`;
export type CommitStatusId = `commit-status:${string}:${string}:${string}`;

export interface ParsedPullRequestTarget {
  readonly owner: string;
  readonly repo: string;
  readonly number: number;
  readonly target: PullRequestTarget;
}

const targetPattern = /^(?<owner>[A-Za-z0-9_.-]+)\/(?<repo>[A-Za-z0-9_.-]+)#(?<number>[1-9]\d*)$/u;

export function parsePullRequestTarget(value: string): ParsedPullRequestTarget | null {
  const match = targetPattern.exec(value);
  const groups = match?.groups;

  if (groups === undefined) {
    return null;
  }

  const owner = groups["owner"];
  const repo = groups["repo"];
  const numberText = groups["number"];

  if (owner === undefined || repo === undefined || numberText === undefined) {
    return null;
  }

  const number = Number.parseInt(numberText, 10);
  const target: PullRequestTarget = `${owner}/${repo}#${number}`;
  return { owner, repo, number, target };
}

export function toReviewThreadId(nodeId: string): ReviewThreadId {
  return `review-thread:${nodeId}`;
}

export function fromReviewThreadId(threadId: ReviewThreadId): string {
  return threadId.slice("review-thread:".length);
}

export function toReviewCommentId(nodeId: string): ReviewCommentId {
  return `review-comment:${nodeId}`;
}

export function toIssueCommentId(databaseId: number): IssueCommentId {
  return `issue-comment:${databaseId}`;
}

export function toCheckRunId(databaseId: number): CheckRunId {
  return `check-run:${databaseId}`;
}

export function toCommitStatusId(sha: string, context: string, createdAt: string | null): CommitStatusId {
  return `commit-status:${sha}:${context}:${createdAt ?? "none"}`;
}
