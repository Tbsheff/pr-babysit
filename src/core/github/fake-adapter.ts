import type { PullRequestTarget, ReviewThreadId } from "../ids.js";
import type { ActorIdentity, IssueComment, NormalizedCheck, PullRequestContext, ReviewThread } from "../types.js";
import type { CommentReply, GitHubReviewAdapter, ThreadReply } from "./review-core.js";

export interface FakeGitHubState {
  readonly actor: ActorIdentity;
  readonly contexts: Readonly<Record<PullRequestTarget, PullRequestContext>>;
  readonly threads: Readonly<Record<PullRequestTarget, readonly ReviewThread[]>>;
  readonly comments: Readonly<Record<PullRequestTarget, readonly IssueComment[]>>;
  readonly checks: Readonly<Record<PullRequestTarget, readonly NormalizedCheck[]>>;
}

export class FakeGitHubReviewAdapter implements GitHubReviewAdapter {
  readonly #state: FakeGitHubState;
  readonly threadReplies: { threadId: ReviewThreadId; body: string }[] = [];
  readonly resolvedThreads: ReviewThreadId[] = [];
  readonly issueComments: { target: PullRequestTarget; body: string }[] = [];

  public constructor(state: FakeGitHubState) {
    this.#state = state;
  }

  public getAuthenticatedActor(): Promise<ActorIdentity> {
    return Promise.resolve(this.#state.actor);
  }

  public getPRContext(target: PullRequestTarget): Promise<PullRequestContext> {
    const context = this.#state.contexts[target];
    if (context === undefined) {
      throw new Error(`Missing fake context for ${target}`);
    }
    return Promise.resolve(context);
  }

  public listReviewThreads(target: PullRequestTarget): Promise<readonly ReviewThread[]> {
    return Promise.resolve(this.#state.threads[target] ?? []);
  }

  public listIssueComments(target: PullRequestTarget): Promise<readonly IssueComment[]> {
    return Promise.resolve(this.#state.comments[target] ?? []);
  }

  public listChecks(target: PullRequestTarget): Promise<readonly NormalizedCheck[]> {
    return Promise.resolve(this.#state.checks[target] ?? []);
  }

  public addThreadReply(threadId: ReviewThreadId, body: string): Promise<ThreadReply> {
    this.threadReplies.push({ threadId, body });
    return Promise.resolve({ body, url: `https://github.test/thread/${encodeURIComponent(threadId)}` });
  }

  public resolveThread(threadId: ReviewThreadId): Promise<void> {
    this.resolvedThreads.push(threadId);
    return Promise.resolve();
  }

  public addIssueComment(target: PullRequestTarget, body: string): Promise<CommentReply> {
    this.issueComments.push({ target, body });
    return Promise.resolve({ body, url: `https://github.test/${encodeURIComponent(target)}#issuecomment-new` });
  }
}
