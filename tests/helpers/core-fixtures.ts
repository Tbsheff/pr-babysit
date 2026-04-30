import type { PullRequestTarget, ReviewCommentId, ReviewThreadId } from "../../src/core/ids.js";
import type { ActorIdentity, IssueComment, PullRequestContext, ReviewThread } from "../../src/core/types.js";

export const target: PullRequestTarget = "OWNER/REPO#123";
export const headSha = "abc123";
export const actor: ActorIdentity = { login: "babysit[bot]", id: "BOT_1", isBot: true };
export const reviewer: ActorIdentity = { login: "reviewer", id: "USER_1", isBot: false };

export function prContext(overrides: Partial<PullRequestContext> = {}): PullRequestContext {
  return {
    target,
    url: "https://github.com/OWNER/REPO/pull/123",
    state: "OPEN",
    merged: false,
    headSha,
    headRefName: "feature",
    baseRefName: "main",
    isSameRepo: true,
    isForkHead: false,
    headRepository: { owner: "OWNER", name: "REPO", fullName: "OWNER/REPO" },
    baseRepository: { owner: "OWNER", name: "REPO", fullName: "OWNER/REPO" },
    author: reviewer,
    changedFiles: [{ path: "src/foo.ts", additions: 1, deletions: 0 }],
    ...overrides
  };
}

export function reviewThread(overrides: Partial<ReviewThread> = {}): ReviewThread {
  const threadId: ReviewThreadId = "review-thread:PRRT_1";
  const commentId: ReviewCommentId = "review-comment:PRRC_1";
  return {
    threadId,
    isResolved: false,
    isOutdated: false,
    path: "src/foo.ts",
    line: 42,
    rootAuthor: reviewer.login,
    rootAuthorAssociation: "MEMBER",
    rootIsBot: false,
    rootBody: "Please fix this.",
    lastCommentAuthor: reviewer.login,
    lastCommentAuthorAssociation: "MEMBER",
    lastCommentIsBot: false,
    lastCommentBody: "Please fix this.",
    url: "https://github.com/OWNER/REPO/pull/123#discussion_r1",
    commentIds: [commentId],
    lastCommentId: commentId,
    capabilities: { canReply: true, canResolve: true, canUnresolve: false },
    comments: [
      {
        commentId,
        databaseId: 1,
        author: reviewer,
        authorAssociation: "MEMBER",
        body: "Please fix this.",
        url: "https://github.com/OWNER/REPO/pull/123#discussion_r1",
        createdAt: "2026-01-01T00:00:00Z",
        containsBabysitMarker: false,
        isAuthenticatedActor: false
      }
    ],
    ...overrides
  };
}

export function issueComment(overrides: Partial<IssueComment> = {}): IssueComment {
  return {
    commentId: "issue-comment:1",
    author: reviewer,
    authorAssociation: "MEMBER",
    isBot: false,
    isAuthenticatedActor: false,
    body: "Top-level comment",
    url: "https://github.com/OWNER/REPO/pull/123#issuecomment-1",
    createdAt: "2026-01-01T00:00:00Z",
    updatedAt: "2026-01-01T00:00:00Z",
    containsBabysitMarker: false,
    ...overrides
  };
}
