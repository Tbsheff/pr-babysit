import { BabysitError } from "../errors.js";
import { resolveGitHubToken } from "../auth.js";
import type { PullRequestTarget, ReviewThreadId } from "../ids.js";
import { fromReviewThreadId, parsePullRequestTarget, toIssueCommentId, toReviewCommentId, toReviewThreadId } from "../ids.js";
import { containsBabysitMarker } from "../idempotency.js";
import { normalizeChecks, type RawCheckRun, type RawCommitStatus } from "../checks/normalize.js";
import type { ActorIdentity, IssueComment, NormalizedCheck, PullRequestContext, ReviewThread } from "../types.js";
import type { CommentReply, GitHubReviewAdapter, ThreadReply } from "./review-core.js";

export function createLiveGitHubAdapter(): GitHubReviewAdapter {
  return new LiveGitHubAdapter(resolveGitHubToken());
}

class LiveGitHubAdapter implements GitHubReviewAdapter {
  readonly #token: string;

  public constructor(token: string) {
    this.#token = token;
  }

  public async getAuthenticatedActor(): Promise<ActorIdentity> {
    const response = await this.#graphql<{ viewer: { login: string; id: string } }>("query Viewer { viewer { login id } }", {});
    return { login: response.viewer.login, id: response.viewer.id, isBot: response.viewer.login.endsWith("[bot]") };
  }

  public async getPRContext(target: PullRequestTarget): Promise<PullRequestContext> {
    const parsed = requireTarget(target);
    const data = await this.#graphql<{
      repository: {
        pullRequest: {
          url: string;
          state: "OPEN" | "CLOSED" | "MERGED";
          merged: boolean;
          headRefOid: string;
          headRefName: string;
          baseRefName: string;
          author: { login: string; id: string } | null;
          headRepository: { owner: { login: string }; name: string; nameWithOwner: string } | null;
          baseRepository: { owner: { login: string }; name: string; nameWithOwner: string };
          files: { nodes: { path: string; additions: number; deletions: number }[] };
        } | null;
      } | null;
    }>(
      `query PR($owner: String!, $repo: String!, $number: Int!) {
        repository(owner: $owner, name: $repo) {
          pullRequest(number: $number) {
            url state merged headRefOid headRefName baseRefName
            author { login ... on User { id } ... on Bot { id } }
            headRepository { owner { login } name nameWithOwner }
            baseRepository { owner { login } name nameWithOwner }
            files(first: 100) { nodes { path additions deletions } }
          }
        }
      }`,
      { owner: parsed.owner, repo: parsed.repo, number: parsed.number }
    );

    const pr = data.repository?.pullRequest;
    if (pr === null || pr === undefined) {
      throw new BabysitError("not_found", `Pull request not found: ${target}`);
    }

    const headRepository = pr.headRepository ?? pr.baseRepository;
    return {
      target,
      url: pr.url,
      state: pr.state,
      merged: pr.merged,
      headSha: pr.headRefOid,
      headRefName: pr.headRefName,
      baseRefName: pr.baseRefName,
      isSameRepo: headRepository.nameWithOwner === pr.baseRepository.nameWithOwner,
      isForkHead: headRepository.nameWithOwner !== pr.baseRepository.nameWithOwner,
      headRepository: {
        owner: headRepository.owner.login,
        name: headRepository.name,
        fullName: headRepository.nameWithOwner
      },
      baseRepository: {
        owner: pr.baseRepository.owner.login,
        name: pr.baseRepository.name,
        fullName: pr.baseRepository.nameWithOwner
      },
      author: {
        login: pr.author?.login ?? "unknown",
        id: pr.author?.id ?? null,
        isBot: pr.author?.login.endsWith("[bot]") ?? false
      },
      changedFiles: pr.files.nodes.map((file) => ({
        path: file.path,
        additions: file.additions,
        deletions: file.deletions
      }))
    };
  }

  public async listReviewThreads(target: PullRequestTarget): Promise<readonly ReviewThread[]> {
    const parsed = requireTarget(target);
    const actor = await this.getAuthenticatedActor();
    const context = await this.getPRContext(target);
    const threads: ReviewThread[] = [];
    let cursor: string | null = null;

    do {
      const data: ReviewThreadsResponse = await this.#graphql<ReviewThreadsResponse>(
        `query ReviewThreads($owner: String!, $repo: String!, $number: Int!, $cursor: String) {
          repository(owner: $owner, name: $repo) {
            pullRequest(number: $number) {
              reviewThreads(first: 100, after: $cursor) {
                pageInfo { hasNextPage endCursor }
                nodes {
                  id isResolved isOutdated path line
                  comments(first: 100) {
                    nodes {
                      id databaseId body authorAssociation createdAt url
                      author { login ... on User { id } ... on Bot { id } }
                    }
                  }
                }
              }
            }
          }
        }`,
        { owner: parsed.owner, repo: parsed.repo, number: parsed.number, cursor }
      );

      const page: ReviewThreadPage | undefined = data.repository?.pullRequest?.reviewThreads;
      if (page === undefined) {
        throw new BabysitError("not_found", `Pull request not found: ${target}`);
      }

      for (const node of page.nodes) {
        const comments = node.comments.nodes.map((comment): ReviewThread["comments"][number] => {
          const commentActor = actorFromLogin(comment.author?.login ?? "ghost", comment.author?.id ?? null);
          return {
            commentId: toReviewCommentId(comment.id),
            databaseId: comment.databaseId,
            author: commentActor,
            authorAssociation: comment.authorAssociation,
            body: comment.body,
            url: comment.url,
            createdAt: comment.createdAt,
            containsBabysitMarker: containsBabysitMarker(comment.body),
            isAuthenticatedActor: sameActor(actor, commentActor)
          };
        });
        const root = comments[0];
        const last = comments.at(-1);
        if (root === undefined || last === undefined) {
          continue;
        }
        threads.push({
          threadId: toReviewThreadId(node.id),
          isResolved: node.isResolved,
          isOutdated: node.isOutdated,
          path: node.path,
          line: node.line,
          rootAuthor: root.author.login,
          rootAuthorAssociation: root.authorAssociation,
          rootIsBot: root.author.isBot,
          rootBody: root.body,
          lastCommentAuthor: last.author.login,
          lastCommentAuthorAssociation: last.authorAssociation,
          lastCommentIsBot: last.author.isBot,
          lastCommentBody: last.body,
          url: last.url,
          commentIds: comments.map((comment) => comment.commentId),
          lastCommentId: last.commentId,
          capabilities: {
            canReply: context.state === "OPEN" && !context.merged,
            canResolve: context.state === "OPEN" && !context.merged && !node.isResolved,
            canUnresolve: context.state === "OPEN" && !context.merged && node.isResolved
          },
          comments
        });
      }

      cursor = page.pageInfo.endCursor;
      if (!page.pageInfo.hasNextPage) {
        cursor = null;
      }
    } while (cursor !== null);

    return threads;
  }

  public async listIssueComments(target: PullRequestTarget): Promise<readonly IssueComment[]> {
    const parsed = requireTarget(target);
    const actor = await this.getAuthenticatedActor();
    const comments = await this.#rest<RestIssueComment[]>(
      `/repos/${parsed.owner}/${parsed.repo}/issues/${String(parsed.number)}/comments`,
      { method: "GET" }
    );

    return comments.map((comment) => {
      const commentActor = actorFromLogin(comment.user.login, comment.user.node_id);
      return {
        commentId: toIssueCommentId(comment.id),
        author: commentActor,
        authorAssociation: comment.author_association,
        isBot: commentActor.isBot,
        isAuthenticatedActor: sameActor(actor, commentActor),
        body: comment.body,
        url: comment.html_url,
        createdAt: comment.created_at,
        updatedAt: comment.updated_at,
        containsBabysitMarker: containsBabysitMarker(comment.body)
      };
    });
  }

  public async listChecks(target: PullRequestTarget): Promise<readonly NormalizedCheck[]> {
    const parsed = requireTarget(target);
    const context = await this.getPRContext(target);
    const [checkRuns, statuses] = await Promise.all([
      this.#rest<RestCheckRunsResponse>(`/repos/${parsed.owner}/${parsed.repo}/commits/${context.headSha}/check-runs`, {
        method: "GET"
      }),
      this.#rest<RestCommitStatus[]>(`/repos/${parsed.owner}/${parsed.repo}/commits/${context.headSha}/statuses`, {
        method: "GET"
      })
    ]);

    return normalizeChecks(
      checkRuns.check_runs.map((checkRun): RawCheckRun => ({
        databaseId: checkRun.id,
        name: checkRun.name,
        status: checkRun.status ?? null,
        conclusion: checkRun.conclusion ?? null,
        url: checkRun.html_url ?? null,
        createdAt: checkRun.created_at ?? null,
        startedAt: checkRun.started_at ?? null,
        completedAt: checkRun.completed_at ?? null,
        workflowName: checkRun.check_suite?.app?.name ?? null,
        appSlug: checkRun.app?.slug ?? null
      })),
      statuses.map((status): RawCommitStatus => ({
        sha: context.headSha,
        context: status.context,
        state: status.state ?? null,
        targetUrl: status.target_url ?? null,
        createdAt: status.created_at ?? null
      }))
    );
  }

  public async addThreadReply(threadId: ReviewThreadId, body: string): Promise<ThreadReply> {
    const data = await this.#graphql<{
      addPullRequestReviewThreadReply: { comment: { body: string; url: string } | null } | null;
    }>(
      `mutation ReplyToThread($threadId: ID!, $body: String!) {
        addPullRequestReviewThreadReply(input: { pullRequestReviewThreadId: $threadId, body: $body }) {
          comment { body url }
        }
      }`,
      { threadId: fromReviewThreadId(threadId), body }
    );
    const comment = data.addPullRequestReviewThreadReply?.comment;
    if (comment === null || comment === undefined) {
      throw new BabysitError("parse_failed", "GitHub omitted review reply comment.");
    }
    return comment;
  }

  public async resolveThread(threadId: ReviewThreadId): Promise<void> {
    await this.#graphql<{ resolveReviewThread: { thread: { id: string; isResolved: boolean } | null } | null }>(
      `mutation ResolveThread($threadId: ID!) {
        resolveReviewThread(input: { threadId: $threadId }) {
          thread { id isResolved }
        }
      }`,
      { threadId: fromReviewThreadId(threadId) }
    );
  }

  public async addIssueComment(target: PullRequestTarget, body: string): Promise<CommentReply> {
    const parsed = requireTarget(target);
    const comment = await this.#rest<RestIssueComment>(`/repos/${parsed.owner}/${parsed.repo}/issues/${String(parsed.number)}/comments`, {
      method: "POST",
      body: JSON.stringify({ body })
    });
    return { body: comment.body, url: comment.html_url };
  }

  async #graphql<T>(query: string, variables: Record<string, string | number | null>): Promise<T> {
    const response = await fetch("https://api.github.com/graphql", {
      method: "POST",
      headers: {
        "authorization": `Bearer ${this.#token}`,
        "content-type": "application/json",
        "user-agent": "pr-babysit"
      },
      body: JSON.stringify({ query, variables })
    });

    if (response.status === 401 || response.status === 403) {
      throw new BabysitError("permission_denied", "GitHub denied the request.");
    }
    if (!response.ok) {
      throw new BabysitError("network_failed", `GitHub request failed with ${response.status}`);
    }

    const json = (await response.json()) as { data?: T; errors?: unknown[] };
    if (json.errors !== undefined && json.errors.length > 0) {
      throw new BabysitError("network_failed", "GitHub GraphQL returned errors.");
    }
    if (json.data === undefined) {
      throw new BabysitError("parse_failed", "GitHub GraphQL response omitted data.");
    }
    return json.data;
  }

  async #rest<T>(urlPath: string, init: { readonly method: "GET" | "POST"; readonly body?: string }): Promise<T> {
    const request: RequestInit = {
      method: init.method,
      headers: {
        "accept": "application/vnd.github+json",
        "authorization": `Bearer ${this.#token}`,
        "content-type": "application/json",
        "user-agent": "pr-babysit",
        "x-github-api-version": "2022-11-28"
      }
    };
    if (init.body !== undefined) {
      request.body = init.body;
    }

    const response = await fetch(`https://api.github.com${urlPath}`, request);

    if (response.status === 401 || response.status === 403) {
      throw new BabysitError("permission_denied", "GitHub denied the request.");
    }
    if (!response.ok) {
      throw new BabysitError("network_failed", `GitHub REST request failed with ${response.status}`);
    }
    return (await response.json()) as T;
  }
}

function requireTarget(target: PullRequestTarget): NonNullable<ReturnType<typeof parsePullRequestTarget>> {
  const parsed = parsePullRequestTarget(target);
  if (parsed === null) {
    throw new BabysitError("parse_failed", `Invalid target: ${target}`);
  }
  return parsed;
}

function actorFromLogin(login: string, id: string | null): ActorIdentity {
  return { login, id, isBot: login.endsWith("[bot]") };
}

function sameActor(left: ActorIdentity, right: ActorIdentity): boolean {
  if (left.id !== null && right.id !== null) {
    return left.id === right.id;
  }
  return left.login === right.login;
}

interface ReviewThreadsResponse {
  readonly repository: {
    readonly pullRequest: {
      readonly reviewThreads: ReviewThreadPage;
    } | null;
  } | null;
}

interface ReviewThreadPage {
  readonly pageInfo: { readonly hasNextPage: boolean; readonly endCursor: string | null };
  readonly nodes: readonly ReviewThreadNode[];
}

interface ReviewThreadNode {
  readonly id: string;
  readonly isResolved: boolean;
  readonly isOutdated: boolean;
  readonly path: string;
  readonly line: number | null;
  readonly comments: {
    readonly nodes: readonly ReviewThreadCommentNode[];
  };
}

interface ReviewThreadCommentNode {
  readonly id: string;
  readonly databaseId: number | null;
  readonly body: string;
  readonly authorAssociation: string;
  readonly createdAt: string;
  readonly url: string;
  readonly author: { readonly login: string; readonly id: string } | null;
}

interface RestIssueComment {
  readonly id: number;
  readonly body: string;
  readonly html_url: string;
  readonly created_at: string;
  readonly updated_at: string;
  readonly author_association: string;
  readonly user: { readonly login: string; readonly id: number; readonly node_id: string; readonly type: string };
}

interface RestCheckRunsResponse {
  readonly check_runs: readonly {
    readonly id: number;
    readonly name: string;
    readonly status?: string | null;
    readonly conclusion?: string | null;
    readonly html_url?: string | null;
    readonly created_at?: string | null;
    readonly started_at?: string | null;
    readonly completed_at?: string | null;
    readonly app: { readonly slug: string | null } | null;
    readonly check_suite: { readonly app: { readonly name: string | null } | null } | null;
  }[];
}

interface RestCommitStatus {
  readonly context: string;
  readonly state?: string | null;
  readonly target_url?: string | null;
  readonly created_at?: string | null;
}
