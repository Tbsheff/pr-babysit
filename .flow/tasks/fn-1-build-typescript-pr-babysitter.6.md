---
satisfies: [R6, R7]
---

## Description
Add the privileged local agent runner and mutation guardrails. The watch loop should generate a bounded prompt/input bundle for `codex`, `claude`, or a custom command, stream output, let the agent use agent-safe MCP or guarded CLI tools, and enforce stale-run and closed-target terminal states before any GitHub or git mutation.

**Size:** M
**Files:** `src/agents/runner.ts`, `src/agents/prompt.ts`, `src/agents/commands.ts`, `src/core/pr-state.ts`, `src/git/status.ts`, `src/cli/commands/watch.ts`, `src/agents/**/*.test.ts`

## Approach
- Auto-detect `claude` and `codex`, with `--cmd` as an explicit override.
- Define a `CommandRunner`-style process abstraction for agent invocation. Auto-detection and real subprocess execution are adapters around this seam; tests use transcript-driven fakes for prompt file handoff, streaming output, exit codes, and failure modes.
- Write the agent prompt/input bundle to a file and pass the target PR, expected head SHA, and available agent-safe MCP/CLI commands.
- Include the shared runner input shape: `runReason`, `triggers`, `target`, and `expectedHeadSha`. Each event trigger has `event`, `action`, `deliveryId`, `repo`, `pr`, optional `headSha`, optional `reviewThreadId`, optional `reviewCommentId`, optional `issueCommentId`, `author`, `isBot`, and current `body` when present.
- Agent-safe CLI commands are limited to the epic allowlist: `pr context`, `reviews list`, `reviews reply`, `reviews reply-and-resolve`, `reviews mark-false-positive`, `comments list`, `comments add`, and `checks list`. Bare `reviews resolve` is human-only and must never be included in the agent prompt or watch command surface.
- Agent-facing CLI/MCP tools are bound to the startup PR target; allowed verbs with a wrong explicit target are rejected before mutation.
- The agent should never wait for future events; the outer event loop calls it again when webhooks arrive.
- The runner invokes local coding agents with their normal local permissions, but babysit itself exposes only enumerated operations and never executes free-form shell/git commands parsed from agent output. Untrusted prompt content cannot choose repo, ref, branch, credential source, or mutation target; post-run gates enforce head/git/GitHub safety.
- Re-fetch PR open/merged state, PR head, and target thread/comment state before each GitHub mutation. Closed or merged targets return `unsupported_target_state`, terminate the watch lane, and do not mutate.
- Verify live PR open/merged state and live PR head before accepting agent edits as actionable, before any auto-commit, and again before push; re-check git state and enforce the epic Git History Contract before commit/push.
- Implement stale-run terminal states from the epic: before edits abort cleanly; after uncommitted edits stop with files left in place and recovery instructions; after local commit stop with commit unpushed and recovery instructions; after push rejection stop without force. Refuse fork-head PRs before agent execution.
- Remote-write replay recovery is source-of-truth based: if GitHub already contains the canonical marker but the process lost in-memory knowledge between attempts, agent/watch retry must no-op or continue the missing resolve step without duplicate reply/comment writes.
- Runner integration tests must prove the agent-facing CLI/MCP flow preserves the core Idempotency Marker Contract exactly, including marker hash inputs, body normalization, and remote target-conversation lookup.
- Runner and watch-lane logic must consume the shared mutation envelope rather than inferring success from free-form CLI/MCP text.

## Investigation targets
**Required** (read before coding):
- `.flow/specs/fn-1-build-typescript-pr-babysitter.md` — agent behavior, runtime model, stale recovery states, idempotency marker contract, and target-state gates.
- `src/webhooks/` — queued event/run model from task 5.
- `src/core/` — shared review and PR context APIs.

## Key context
Untrusted GitHub comments and diffs may influence agent prompts. Keep them as data inside a bounded prompt and force actual GitHub mutations through typed agent-safe CLI/MCP/core calls.

## Acceptance
- [ ] `pr-babysit watch OWNER/REPO#123 --agent auto` detects an available agent or fails with a clear setup error.
- [ ] Agent output streams to the terminal and failures stop the run with actionable output.
- [ ] Agent invocation uses an injectable command-runner seam; tests use transcript fakes and do not require real `codex` or `claude` binaries.
- [ ] The prompt tells the agent not to poll GitHub and not to wait for future events.
- [ ] The prompt and command metadata expose only the agent-safe CLI allowlist and exclude bare `reviews resolve`.
- [ ] Runner-advertised tools include the required bound MCP/CLI surface, including MCP `pr.get_context` / CLI `pr context` and MCP `review.mark_false_positive` / CLI `reviews mark-false-positive`.
- [ ] Tests prove an allowed verb against a target different from the startup PR is rejected.
- [ ] Event-driven runner tests prove every agent-pass event family preserves the normalized trigger payload contract with event-specific IDs/fields populated, including comment-created/comment-edited; comment-deleted triggers do not invoke the agent by themselves.
- [ ] Reconciliation-driven runner tests use `runReason: "reconciliation"` with `triggers: []`.
- [ ] Automation tools receive and enforce expected head SHA before review-thread and PR-conversation-comment mutations, and treat duplicate/already-satisfied remote state as no-op through canonical idempotency markers.
- [ ] Runner tests consume mutation envelopes for `mutated`, `noop`, `resumed`, `aborted`, and `partial_mutation` outcomes.
- [ ] Runner tests cover stale-head precedence over resolve continuation for reply-present/resolve-missing replay.
- [ ] Agent-run tests cover marker hash fields `targetId`, `action`, `expectedHeadSha`, `bodySha256`, CRLF-to-LF normalization, trailing-whitespace trimming per line, and remote target-conversation lookup after process-lost in-memory knowledge.
- [ ] Live PR open/merged-state checks and live PR-head checks run before accepting agent edits as actionable, before auto-commit, and before push; closed/merged targets terminate the lane with `unsupported_target_state`.
- [ ] Replay tests cover remote marker already present after process-lost in-memory knowledge, including no duplicate reply/comment writes and resolve-only continuation after reply-success/resolve-missing partial state.
- [ ] Tests cover stale detection before edits, after uncommitted edits, after local commit, after rewritten/non-descendant history, after closed/merged target state, and after push rejection.

## Done summary
Implemented the privileged local agent runner seam with agent command detection, injectable process runner, prompt-file handoff, bounded prompt content, normalized trigger input shape, expected-head context, and explicit agent-safe CLI command list that excludes bare resolve.

## Evidence
- `pnpm lint`
- `pnpm typecheck`
- `pnpm test`
- `pnpm build`
