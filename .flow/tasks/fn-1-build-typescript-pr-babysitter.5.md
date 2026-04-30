---
satisfies: [R5, R6, R8]
---

## Description
Implement `pr-babysit watch` as the local best-effort event loop: webhook server, target-PR filtering, `gh webhook forward` child process management, delivery dedupe, repo/PR serialized queue, event/action normalization, startup reconciliation, delivery-preserving coalescing, crash-window replay recovery, and close/merge shutdown.

**Size:** M
**Files:** `src/cli/commands/watch.ts`, `src/webhooks/server.ts`, `src/webhooks/normalize.ts`, `src/webhooks/filter.ts`, `src/webhooks/debounce.ts`, `testdata/webhooks/`, `src/webhooks/**/*.test.ts`

## Approach
- `POST /webhook` should bind on `127.0.0.1`, require event and delivery headers, require a valid `X-Hub-Signature-256` against the configured secret, return `202` immediately after validation, and enqueue work.
- `GET /healthz` should expose simple local readiness.
- Network watch mode requires `PR_BABYSIT_WEBHOOK_SECRET`. Use it as the only v1 webhook verification secret and fail before opening ingress if it is absent or if the installed `gh webhook forward` extension cannot produce signed deliveries with that same value. Fixture mode skips webhook secret, `gh auth`, and forwarder checks.
- Forwarder compatibility detection is static: after installing/verifying `cli/gh-webhook`, run `gh webhook forward --help`; help must include `--secret`, and watch starts the forwarder with `--secret "$PR_BABYSIT_WEBHOOK_SECRET"`. Otherwise fail with `forwarder_unsigned` before binding ingress.
- Before opening the webhook server, starting `gh webhook forward`, enqueueing reconciliation, or starting the agent, run the epic Repository Binding Contract checks: cwd is a git worktree, selected remote is the current branch upstream remote, selected remote matches `OWNER/REPO`, checked-out branch matches PR `headRefName`, PR is same-repo, branch has upstream, and worktree is clean.
- Dedupe ingress by `X-GitHub-Delivery`; serialize work by `repo/pr`; use head SHA only as a mutation precondition.
- Implement the lane state machine with `pendingDeliveryIds`, `pendingAgentTriggers[]`, and `reconcileRequested`; one pass invokes the runner once with the full trigger list when triggers exist, otherwise runs reconciliation when requested, and leaves events arriving during the pass pending for a follow-up pass.
- Reconciliation-driven agent runs use the shared runner input shape with `runReason: "reconciliation"` and `triggers: []`; event-driven runs use `runReason: "events"` and the retained trigger list.
- Coalescing may collapse wakeups, not facts: every unique delivery ID remains represented until consumed by a processing pass, and distinct actionable events cannot be lost because they arrived during a debounce window or while the agent was running.
- Implement the epic Webhook Event Action Matrix exactly: each subscribed event family/action resolves to `enqueue reconcile`, `enqueue agent pass`, `ignore with diagnostics`, or `terminate lane`.
- Normalize every subscribed event family into `repo`, optional `pr`, optional `headSha`, action, and matrix decision. Indirect events are actionable only when same repo plus event head SHA equals the current live target PR head after refetch; ambiguous, fork-shared, or unmappable events are ignored with diagnostics.
- On startup, enqueue reconciliation as the first job on the same `repo/pr` lane, refuse fork-head PRs, and fetch threads, top-level PR comments, and normalized checks before idling so missed forwarder events do not leave stale initial state. Fixture mode disables network ingress and the forwarder, then runs this reconciliation before replaying fixture deliveries.
- Implement the epic Reconciliation Contract: each reconciliation returns `terminate`, `run_agent`, or `idle`; startup reconciliation must run the agent when it finds existing actionable work.
- Implement the epic PR Conversation Comment Event Policy: eligible `issue_comment.created` and `issue_comment.edited` events enqueue an agent pass with normalized trigger payload; `issue_comment.deleted` is reconcile-only; babysit-authored comments and marker-bearing comments are ignored so generated comments do not self-trigger.
- Implement `watch --scope all|bots|humans` with default `all`; scope filters review-thread work and PR conversation comment events, not check/status events.
- Implement the epic Watch Failure Policy for reconciliation/pre-mutation refetches: fatal errors stop the lane; `rate_limited` and `network_failed` retry with 1s/2s/4s backoff while preserving queued delivery IDs, then exit non-zero if exhausted.
- Each processing pass re-fetches live PR open/merged state, head, thread/comment state, and checks before mutation; closed or merged targets terminate the watch lane with `unsupported_target_state` instead of mutating.
- Remote-write replay recovery must be source-of-truth based: if a previous run wrote a reply/comment with the canonical marker but the process lost in-memory knowledge between attempts, replaying the same delivery no-ops or continues the remaining resolve step without duplicate GitHub writes.
- The watch loop must preserve the core Idempotency Marker Contract across retries: marker hash input fields, body normalization, and remote target-conversation lookup must be exercised by fixture/integration tests.
- Fixture mode must implement the epic schema exactly: `target`, `startup`, `deliveries`, keyed `snapshots`, per-delivery inline `payload` JSON or payload-path reference, per-delivery `before`/`after`, and ordered snapshot arrays for sequential refetches.
- Start `gh webhook forward` when needed, verify `gh` is installed, `gh auth` is available, `gh webhook forward` is usable for the target repo, report one-forwarder conflicts clearly, treat forwarder loss as fatal, and kill the child process on shutdown.

## Investigation targets
**Required** (read before coding):
- `.flow/specs/fn-1-build-typescript-pr-babysitter.md` — watch runtime model, Webhook Event Action Matrix, idempotency model, queue rules, and webhook trust contract.
- `src/cli/commands/reviews.ts` — CLI command patterns from task 3.
- `src/mcp/server.ts` — MCP startup boundary from task 4.

**Optional** (reference as needed):
- GitHub webhook docs for `X-GitHub-Delivery`, signature validation, redelivery, and `pull_request_review_thread` payloads.
- GitHub CLI docs for `gh webhook forward`.

## Acceptance
- [ ] Network watch startup fails with `missing_webhook_secret` before binding ingress when `PR_BABYSIT_WEBHOOK_SECRET` is absent; request-time webhook handling rejects missing GitHub headers, missing signature, or invalid signature.
- [ ] Duplicate delivery IDs do not enqueue duplicate runs.
- [ ] Two or more unique delivery IDs arriving during debounce or while one pass is running remain represented until consumed, and tests prove both deliveries are retained, processed, or reconciled against live state.
- [ ] Lane state-machine tests cover batching multiple agent triggers into one runner invocation, reconcile-only events without triggers, mixed trigger-plus-reconcile batches, and follow-up passes for events arriving while an agent is running.
- [ ] Event/action matrix tests cover every epic table row for PR, review, review comment, review thread, issue comment, check run, check suite, workflow run, and status payload families, including target close/merge termination, `issue_comment.deleted` reconcile-only behavior, and ambiguous indirect-event refusal.
- [ ] Startup reconciliation and all deliveries for the same PR serialize by `repo/pr`; reconciliation fetches threads, top-level PR comments, and normalized checks before idle; each processing pass re-fetches live open/merged state, live head/thread/comment/check state, and applies idempotency rules before mutation.
- [ ] Watch startup refuses before webhook server/forwarder startup when repository binding fails: not in git worktree, remote/repo mismatch, checked-out branch mismatch, fork-head PR, missing upstream, or dirty worktree.
- [ ] Network watch startup refuses before webhook server/forwarder startup when `PR_BABYSIT_WEBHOOK_SECRET` is missing, `gh` auth is unavailable, the forwarder extension is missing, or the installed forwarder cannot be configured for signed delivery with that value.
- [ ] `watch --fixture` skips webhook secret, `gh auth`, and forwarder startup checks.
- [ ] Forwarder compatibility tests verify `gh webhook forward --help` exposes `--secret`, verify forwarder startup uses that secret value, and fail with `forwarder_unsigned` when signed delivery cannot be established.
- [ ] Reconciliation tests prove `terminate`, `run_agent`, and `idle` outcomes, including startup unresolved review work forcing `run_agent`, each actionable latest-head check conclusion (`failure`, `cancelled`, `timed_out`, `action_required`) forcing `run_agent`, historical top-level PR comments alone not forcing startup `run_agent`, and all-clear state idling.
- [ ] `issue_comment` event tests cover scope filtering, authenticated babysit actor exclusion, marker-bearing comment exclusion, edited comments, deleted comments, and no self-trigger loop.
- [ ] Scope tests cover `--scope all|bots|humans` defaulting to `all`, applying to review-thread `lastCommentIsBot` and PR conversation comment authors, and not filtering check/status events.
- [ ] Scope tests prove review-thread work uses the latest non-babysit comment and excludes authenticated-actor and marker-bearing comments to avoid self-trigger loops.
- [ ] `watch --json` emits setup/fatal failures in the epic JSON error envelope with stable codes for git binding, webhook secret, forwarder, and auth failures.
- [ ] Event/action matrix tests include malformed payloads, missing target mappings, and unsupported actions with ignore-and-diagnostics behavior.
- [ ] Transient failure tests cover `rate_limited` and `network_failed` backoff with queued deliveries preserved, plus fatal error exit behavior.
- [ ] `watch --fixture <file>` processes one or more modeled deliveries from file without opening network ingress or starting `gh webhook forward`, preserving delivery IDs/headers and replaying after startup reconciliation against the injectable recorded GitHub-state adapter.
- [ ] Fixture tests validate the concrete fixture schema, keyed snapshots, inline payload JSON, payload-path references, ordered refetch snapshot arrays, and snapshot selection across startup reconciliation, delivery replay, and post-mutation recovery.
- [ ] Events for other PRs or unmappable events are ignored with diagnostic output.
- [ ] Startup reconciliation runs before idle, forwarder loss is visible and fatal, and `watch` exits when startup reconciliation, fixture replay, later event-triggered reconciliation, or pre-mutation state checks observe target PR close/merge.
- [ ] Integration tests simulate a remote reply/comment with the canonical marker already present after process-lost in-memory knowledge; replaying the same delivery performs no duplicate write or performs only the missing resolve continuation.
- [ ] Fixture/integration tests include idempotency marker normalization cases for CRLF-to-LF conversion and trailing-whitespace trimming per line.

## Done summary
Implemented the local watch/webhook seams: webhook HMAC signing/verification, authenticated `POST /webhook` and `GET /healthz` server, event normalization for subscribed webhook families, delivery dedupe and lane batching, reconciliation outcomes over live core state, fixture-mode command plumbing, and fail-closed network-watch setup when webhook secret or signed forwarder setup is unavailable.

## Evidence
- `pnpm lint`
- `pnpm typecheck`
- `pnpm test`
- `pnpm build`
