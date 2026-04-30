---
satisfies: [R2, R3, R6]
---

## Description
Expose stable human and agent-shell CLI commands over the shared review core: PR context, PR parsing, review thread listing, guarded replies, human resolution, reply-and-resolve, false-positive marking, top-level PR comments, and checks. Commands must be usable from normal terminals and from agents that prefer shell JSON over MCP.

**Size:** M
**Files:** `src/cli/commands/reviews.ts`, `src/cli/commands/comments.ts`, `src/cli/commands/checks.ts`, `src/cli/pr-target.ts`, `src/bin/pr-babysit.ts`, `src/cli/**/*.test.ts`

## Approach
- Support `OWNER/REPO#123`, PR URL, number-only from the current branch upstream remote, and no-arg current-branch resolution where possible. V1 has no manual remote override.
- Mutating automation-oriented review and comment commands accept `--expected-head` and pass it to the shared core mutation precondition.
- Keep `--json` output compact and stable, using shared core typed IDs without lossy conversion.
- CLI JSON must preserve the shared mutation result envelope exactly for mutating commands.
- Surface the shared core error taxonomy mechanically in CLI JSON and terminal errors: `auth_failed`, `parse_failed`, `permission_denied`, `not_found`, `stale_head`, `unsupported_target_state`, `partial_mutation`, `rate_limited`, and `network_failed`. Do not rename, wrap, or invent CLI-only error codes.
- Use non-zero exits and machine-readable error shapes for auth/API/parse/stale-head/unsupported-target-state/partial-mutation failures from the shared core.
- Rename or model PR conversation commands so they clearly add top-level PR comments rather than threaded issue-comment replies.
- Bare `reviews resolve` is human-only; it must not be exposed in watch/agent prompts, allowlists, or automation metadata.
- Shell-agent parity requires `pr context` and `reviews mark-false-positive`.
- Automation-oriented mutating commands must use the core Idempotency Marker Contract exactly; CLI tests should assert marker-compatible replay behavior, not a CLI-specific marker implementation.
- For `comments add`, identical automated top-level comment intent uses the core `PullRequestTarget` targetId and collapses to a no-op on the same expected head/body.
- `checks list --json` must expose the exact normalized checks contract from core, including `id`, `lastObservedAt`, nullable timestamps, source mapping, dedupe winner, lexicographic canonical-ID tie-breaker, and normalized enum values.

## Investigation targets
**Required** (read before coding):
- `.flow/specs/fn-1-build-typescript-pr-babysitter.md` — CLI contract, core error taxonomy, idempotency marker contract, checks contract, and target parsing rules.
- `src/core/` — shared review core from task 2.

## Acceptance
- [ ] `pr-babysit reviews list OWNER/REPO#123 --json` returns compact JSON from the shared review core.
- [ ] `pr-babysit reviews reply OWNER/REPO#123 THREAD_ID --expected-head <sha> --body "..."` and `reply-and-resolve` use stable JSON, report live head SHA, and return stale-head/idempotency/partial-failure errors consistently.
- [ ] CLI errors expose shared core error codes verbatim with no CLI-only renaming or wrapper taxonomy.
- [ ] CLI mutation JSON preserves the shared mutation envelope fields and step-state enums exactly.
- [ ] Human bare `reviews resolve` uses the shared envelope with `idempotencyKey: null` and remains excluded from automation.
- [ ] CLI mutation tests prove replay behavior uses the core marker algorithm, including expected head in the marker input and body normalization compatibility for CRLF and trailing whitespace.
- [ ] CLI top-level PR comment tests prove duplicate automated comment intent collapses according to the core `PullRequestTarget` idempotency unit.
- [ ] Human `reviews resolve` remains available as a CLI command but is not used by automated watch/agent paths.
- [ ] Agent-safe CLI documentation/metadata allowlists only `pr context`, `reviews list`, `reviews reply`, `reviews reply-and-resolve`, `reviews mark-false-positive`, `comments list`, `comments add`, and `checks list`; bare `reviews resolve` is human-only.
- [ ] `comments list/add` and `checks list --json` use the separate core surfaces and stable schemas; automation-oriented `comments add` requires `--expected-head`.
- [ ] `comments list --json` exposes the canonical PR conversation comment schema from core.
- [ ] `checks list --json` includes `id`, `kind`, `source`, `name`, `status`, `conclusion`, `url`, nullable `createdAt`, nullable `startedAt`, nullable `completedAt`, nullable `lastObservedAt`, normative enum mapping, and the core dedupe/tie-break behavior.
- [ ] PR-scoped CLI commands include the live head SHA they acted on in JSON output or terminal success output.
- [ ] PR target parsing is covered for `OWNER/REPO#123`, URL, number-only, no arg, invalid, and ambiguous cases.

## Done summary
Implemented CLI command surfaces for `pr context`, `reviews list/reply/resolve/reply-and-resolve/mark-false-positive`, `comments list/add`, `checks list`, PR target parsing for direct targets and GitHub URLs, stable JSON output, verbatim core error envelopes, and the agent-safe command allowlist excluding human-only bare resolve.

## Evidence
- `pnpm lint`
- `pnpm typecheck`
- `pnpm test`
- `pnpm build`
- `node dist/bin/pr-babysit.js --help`
