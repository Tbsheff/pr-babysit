---
satisfies: [R2, R3, R4, R6, R9]
---

## Description
Add `pr-babysit mcp` as a stdio MCP server exposing typed request/response tools over the pure review core. `watch` starts it in bound mode as `pr-babysit mcp --target OWNER/REPO#NUMBER` for agent mutations. Bare `pr-babysit mcp` is read-only/inspector-safe. The MCP profile helps agents inspect and mutate GitHub review state without knowing GitHub GraphQL or shell command details, but it does not expose privileged runner/git capability or bare resolve-without-reply.

**Size:** M
**Files:** `src/mcp/server.ts`, `src/mcp/tools/review.ts`, `src/mcp/tools/pr.ts`, `src/mcp/tools/comments.ts`, `src/mcp/tools/checks.ts`, `src/mcp/**/*.test.ts`

## Approach
- Use the production MCP TypeScript SDK v1 line and stdio transport first.
- Default tools: `pr.get_context`, `review.list_threads`, `review.reply`, `review.reply_and_resolve`, `review.mark_false_positive`, `comments.list`, `comments.add`, and `checks.list`.
- Mutating tools require bound mode; they reject any explicit target that differs from the server `--target`.
- Do not expose watch, polling, arbitrary shell, commit, push, or bare `review.resolve_thread` in the default agent-safe MCP surface.
- Mutating review and comment tools require target PR context and expected head SHA from `pr.get_context`, use shared core typed IDs without lossy conversion, and surface idempotent no-op vs abort states distinctly.
- `pr.get_context` returns the full canonical core PR context shape needed by the mutation protocol and repository binding decisions.
- `review.mark_false_positive` must call the shared core `markFalsePositive` capability; it must not duplicate reply/resolve/idempotency behavior in the MCP layer.
- Surface shared core error codes exactly as returned by core: `auth_failed`, `parse_failed`, `permission_denied`, `not_found`, `stale_head`, `unsupported_target_state`, `partial_mutation`, `rate_limited`, and `network_failed`. Do not rename them for MCP.
- `checks.list` must expose the exact normalized checks contract from core, including required fields, `lastObservedAt` derivation, source mapping, dedupe key, winner selection, canonical-ID tie-breaker, and normalized enum values.
- All mutating tools rely on the epic Idempotency Marker Contract from core: canonical JSON hash fields, body normalization, remote conversation replay lookup, and partial-recovery behavior are not reimplemented differently in MCP.
- `comments.add` inherits the core top-level PR comment idempotency unit: `targetId = OWNER/REPO#NUMBER`, with identical automated comment intent on the same expected head/body treated as a no-op.

## Investigation targets
**Required** (read before coding):
- `.flow/specs/fn-1-build-typescript-pr-babysitter.md` — MCP contract, capability boundary, core error taxonomy, idempotency marker contract, and checks contract.
- `src/core/` — shared review core from task 2.

**Optional** (reference as needed):
- MCP TypeScript SDK v1 server/tool documentation.

## Key context
Current MCP docs warn not to mix v1 production imports with v2 pre-alpha package surfaces. Keep this task pinned to one MCP SDK line.

## Acceptance
- [ ] An MCP inspector/client can call every default agent-safe tool and receive compact structured JSON.
- [ ] Tool inputs are schema-validated, mutating review and comment tools require expected head SHA, and outputs are stable for agents.
- [ ] `pr.get_context` returns the full canonical PR context shape: target, URL, state, merged, head SHA/ref, base ref, same-repo/fork flags, head/base repositories, author, and changed files.
- [ ] `comments.list` exposes the canonical PR conversation comment schema from core.
- [ ] Mutating MCP tools preserve the shared mutation envelope fields and step-state enums exactly.
- [ ] MCP tool errors expose shared core error codes verbatim with no MCP-only renaming or wrapper taxonomy.
- [ ] No MCP tool can poll, watch, run arbitrary shell, commit, push, or bare-resolve a thread without reply.
- [ ] Bound-mode tests cover `pr-babysit mcp --target OWNER/REPO#NUMBER`, wrong-target rejection, and bare `pr-babysit mcp` read-only behavior.
- [ ] `review.mark_false_positive` delegates to core `markFalsePositive`, leaves visible GitHub thread context by replying with the reason plus canonical idempotency marker before resolving, and duplicate delivery/retry recovery is covered.
- [ ] MCP tests cover marker compatibility by proving the tool output/replay path uses core marker behavior, including CRLF-to-LF and trailing-whitespace normalization cases.
- [ ] MCP comment tests cover duplicate top-level automated PR comment intent as a no-op using the core `PullRequestTarget` idempotency unit.
- [ ] `checks.list` returns the normalized latest-head union schema from the core, including `id`, nullable timestamps, `lastObservedAt`, dedupe/tie-break behavior, and normative normalized enum values.

## Done summary
Implemented `pr-babysit mcp` with the production MCP TypeScript SDK stdio server, default agent-safe tools for PR context, review threads, guarded review replies, reply-and-resolve, false-positive marking, top-level PR comments, and checks. Bound-mode mutation enforcement rejects bare/read-only mutation attempts and wrong explicit targets.

## Evidence
- `pnpm lint`
- `pnpm typecheck`
- `pnpm test`
- `pnpm build`
