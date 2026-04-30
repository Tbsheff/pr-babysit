---
satisfies: [R2, R3, R6, R9]
---

## Description
Build the pure shared GitHub review core used by both CLI and MCP. It should authenticate via `GITHUB_TOKEN` or `gh auth token`, fetch PR context, list paginated review threads through GraphQL, keep PR issue comments separate as top-level conversation comments, provide read-only normalized checks data, and enforce guarded reply-before-resolve.

**Size:** M
**Files:** `src/core/github/`, `src/core/review/`, `src/core/checks/`, `src/core/types.ts`, `src/core/auth.ts`, `src/core/github/*.test.ts`

## Approach
- Treat GraphQL `reviewThreads` as the inline-review source of truth.
- Include `ReviewCommentId` values for comments inside each returned review thread; v1 mutations still act on thread IDs.
- Use GitHub REST issue comments only to list or add top-level PR conversation comments; automated top-level comment writes also accept the same expected-head precondition as review-thread mutations.
- Implement core review mutations `replyToThread`, `resolveThread`, `replyAndResolve`, `markFalsePositive`, `listIssueComments`, and `addPrConversationComment`; `markFalsePositive` is core domain behavior, not MCP glue.
- Define `checks.list` exactly as the epic Checks Contract: latest-head read-only normalized union of check runs and commit statuses with required fields `kind`, `source`, `name`, `status`, `conclusion`, `url`, `createdAt`, `startedAt`, `completedAt`, and `lastObservedAt`.
- Derive `lastObservedAt` as the latest present timestamp among `completedAt`, `startedAt`, and `createdAt`; dedupe by `kind + source + name`; choose the winner by newest `lastObservedAt`, with canonical ID as the deterministic tie-breaker; map GitHub check/status enums into the documented normalized state set.
- Mutating review and PR-conversation-comment APIs must accept an automation mutation precondition when called by watch/agent paths and re-fetch live PR open/merged state, live PR head, and target thread/comment state immediately before mutation.
- Own a named core PR-context API with the epic output shape, used by CLI, MCP, watch, and git guards.
- Own the core authenticated-actor API and PR conversation comment schema used by watch, CLI, and MCP.
- Define canonical typed IDs and shared error taxonomy from the epic Core Contract so CLI and MCP do not convert IDs or invent errors independently.
- Implement the exact canonical ID wire formats from the epic for every exported ID type, including check/status IDs used for tie-breaks.
- Return the shared Mutation Result Contract envelope for every mutating operation, including no-op, resumed, and partial mutation outcomes.
- Apply the epic Idempotency Marker Contract before side effects: marker `<!-- pr-babysit:id=v1:<sha256> -->`; hash input is canonical JSON with `targetId`, `action`, `expectedHeadSha`, and `bodySha256`; body normalization converts CRLF to LF and trims trailing whitespace per line; replay searches the remote target conversation, not local state.
- For top-level PR comments, set `targetId` to the canonical `PullRequestTarget` string `OWNER/REPO#NUMBER`; identical automated top-level comment intent on the same PR/action/head/body is a no-op in v1.
- Duplicate intent no-ops; already-resolved resolve no-ops; missing, closed, merged, or unsupported target state aborts with shared error codes; `replyAndResolve` and `markFalsePositive` resume when reply succeeded but resolve did not.
- Make `replyAndResolve` perform reply then resolve, with no resolve attempt when reply fails. Make `markFalsePositive` write the visible reason plus marker, then resolve with the same ordering and guards.

## Investigation targets
**Required** (read before coding):
- `.flow/specs/fn-1-build-typescript-pr-babysitter.md` — acceptance, runtime model, checks contract, idempotency contract, and API boundaries.

**Optional** (reference as needed):
- GitHub GraphQL docs for `reviewThreads`, `addPullRequestReviewThreadReply`, and `resolveReviewThread`.
- GitHub REST docs for issue comments, check runs, and commit statuses.

## Key context
Prior memory and research agree that live `pullRequest.reviewThreads` is the reliable blocker graph; `agent-reviews --unanswered` style aggregation is noisier and should not drive the core model.

## Acceptance
- [ ] Core outputs use canonical `PullRequestTarget`, `ReviewThreadId`, `ReviewCommentId`, `IssueCommentId`, `CheckRunId`, and `CommitStatusId` types; REST/GraphQL translation is confined to core helpers.
- [ ] Canonical IDs serialize exactly as the epic strings: `OWNER/REPO#NUMBER`, `review-thread:<graphql-node-id>`, `review-comment:<graphql-node-id>`, `issue-comment:<database-id>`, `check-run:<database-id>`, and `commit-status:<sha>:<context>:<createdAt-or-none>`.
- [ ] Shared core errors are exactly the epic taxonomy: `auth_failed`, `parse_failed`, `permission_denied`, `not_found`, `stale_head`, `unsupported_target_state`, `partial_mutation`, `rate_limited`, and `network_failed`.
- [ ] `listReviewThreads` returns the epic thread output contract from paginated GraphQL data: `threadId`, `isResolved`, `isOutdated`, `path`, `line`, root and latest-comment author/body/bot fields, `url`, `commentIds`, `lastCommentId`, and `capabilities.canReply/canResolve/canUnresolve`.
- [ ] Review-thread actionability helpers identify the latest non-babysit comment and exclude authenticated-actor and marker-bearing comments from scope decisions.
- [ ] Capability tests assert capabilities derive from live GitHub/thread/permission state and remain independent of MCP or agent-safe policy.
- [ ] `listReviewThreads` includes `ReviewCommentId` values for individual thread comments without making those IDs mutating automation targets.
- [ ] `replyToThread`, `replyAndResolve`, `markFalsePositive`, and `addPrConversationComment` re-fetch PR open/merged state and live head for automation callers, surface `unsupported_target_state` for closed/merged PRs, and surface `stale_head` before mutating when the expected head does not match.
- [ ] `getPRContext` returns the canonical PR context shape: target, URL, state, merged, head SHA/ref, base ref, same-repo/fork flags, head/base repositories, author, and changed files.
- [ ] `getAuthenticatedActor` returns `{ login, id, isBot }`, and all self-filtering helpers use that shared identity.
- [ ] `listIssueComments` returns the canonical PR conversation comment schema: `commentId`, author fields, bot/self flags, body, URL, created/updated timestamps, and marker metadata.
- [ ] `replyToThread`, `resolveThread` for human CLI use, `replyAndResolve`, and `markFalsePositive` use GraphQL thread mutations and surface permission failures clearly.
- [ ] Mutating APIs return the shared mutation envelope with required `targetId`, `headSha`, `outcome`, `mutated`, nullable `idempotencyKey`, step states, and URL where available; only human-only non-marker operations may use `idempotencyKey: null`.
- [ ] `markFalsePositive` writes a visible reason with the canonical marker, then resolves; duplicate replay no-ops, and reply-present/resolve-missing replay performs only the resolve continuation.
- [ ] Partial replay tests prove `stale_head` takes precedence over resolve continuation when the reply marker exists but live PR head drifted.
- [ ] Idempotency marker tests cover hash input fields `targetId`, `action`, `expectedHeadSha`, `bodySha256`, CRLF-to-LF conversion, trailing-whitespace trimming per line, deterministic JSON key ordering, and remote conversation lookup.
- [ ] Top-level PR comment idempotency tests prove `targetId = OWNER/REPO#NUMBER` and identical automated comment intent on the same expected head/body collapses to a no-op.
- [ ] `listIssueComments` and `addPrConversationComment` are separate from review-thread APIs, do not imply threaded replies, enforce expected-head preconditions for automation callers, and use canonical idempotency markers for replay safety.
- [ ] `listChecks` returns the normalized latest-head union of check runs and commit statuses with `id: CheckRunId | CommitStatusId`, required nullable timestamp fields, documented source mapping, normative check-run/status enum mapping, dedupe key `kind + source + name`, `lastObservedAt` derivation, newest-`lastObservedAt` winner selection, and lexicographically ascending canonical-ID tie-breaker.
- [ ] Unit tests cover pagination, malformed responses, auth failure, rate-limit-shaped errors, closed/merged target aborts, stale-head precondition failure, idempotent replay, check/status normalization including timestamp and tie-break rules, and reply-success/resolve-failure partial outcomes.

## Done summary
Pending implementation.

## Evidence
Pending implementation.
