---
satisfies: [R1, R6, R7, R10]
---

## Description
Finish the fail-closed git commit/push loop, document the operational contract, and add the tiny `/babysit` skill wrapper that delegates to `pr-babysit watch` without duplicating review logic.

**Size:** M
**Files:** `src/git/status.ts`, `src/git/commit.ts`, `src/git/push.ts`, `src/cli/commands/watch.ts`, `skills/babysit/SKILL.md`, `README.md`, `docs/mcp-config-examples.md`, `docs/auth.md`, `docs/operations/gh-webhook-forwarding.md`, `docs/safety/always-push.md`, `src/git/**/*.test.ts`

## Approach
- `watch` always refuses to start on a dirty worktree; there is no dirty-tree handoff exception in v1.
- V1 `watch` runs from inside the checked-out target repository worktree; `--worktree` is out of scope. Before startup, validate that cwd is in a git worktree, the selected remote is the current branch upstream remote, that remote matches `OWNER/REPO`, the checked-out branch matches PR `headRefName`, and the PR is same-repo.
- At watch startup, record a git baseline `{upstreamSha, preRunHeadSha}` after verifying branch/upstream and clean worktree. The eligible push set is exactly `preRunHeadSha..HEAD` after safety checks; `upstreamSha` is used for remote-advancement detection and diagnostics.
- Before auto-commit and again before push, re-fetch live PR open/merged state and live PR head; closed/merged targets return `unsupported_target_state`, terminate the watch lane, and do not commit or push.
- Before auto-commit and again before push, verify the live PR head still matches the expected head SHA; then verify branch/upstream, fetch remote state, enforce the epic Git History Contract, block detached or mismatched branch, and stop on push rejection or remote advancement.
- Enforce that new HEAD is a strict descendant of `preRunHeadSha` and that the push set is exactly `preRunHeadSha..HEAD`. Clean branches already ahead of upstream and pre-existing local commits are not silently pushed as babysit work.
- If the agent already committed during this run, push commits in `preRunHeadSha..HEAD`; if the agent changed files only, create the default review-feedback commit; if nothing changed, do not create an empty commit.
- Refuse fork-head PRs in v1 and never force-push.
- The `/babysit` skill should only run `pr-babysit watch "$ARGUMENTS"`; no Python script, no `agent-reviews`, and no embedded review handling.
- Docs are part of the safety boundary, not polish.
- No-change agent runs skip commit and skip push unless there is an existing unpushed commit created during the agent run.

## Investigation targets
**Required** (read before coding):
- `.flow/specs/fn-1-build-typescript-pr-babysitter.md` — always-push, webhook trust, stale recovery, git history contract, and wrapper contract.
- `src/agents/runner.ts` — agent output and mutation handoff from task 6.
- `src/cli/commands/watch.ts` — watch loop integration point.
- `src/testing/fixtures/` — disposable git repo/remotes from task 1.

**Optional** (reference as needed):
- Git docs for `status`, `commit`, `push`, upstream detection, and fast-forward safety.

## Key context
The repository currently is not a git checkout, so product tests must simulate git hazards and the final end-to-end proof needs a real PR in a real git repo.

## Acceptance
- [ ] Not-inside-git-worktree, remote/repo mismatch, checked-out branch mismatch, dirty tree at watch startup, clean branch already ahead of upstream before babysit starts, pre-existing local commit plus babysit commit, fork-head PR, detached branch, missing upstream, remote advancement, rewritten ancestry, non-descendant history, stale head before auto-commit, stale head before push, closed/merged PR before auto-commit, closed/merged PR before push, and push rejection all stop with clear errors.
- [ ] Watch setup and git guard failures surface stable machine-readable setup codes where defined by the epic.
- [ ] `watch --json` setup/fatal error behavior is documented with the JSON error envelope and stable setup codes.
- [ ] Startup captures `{upstreamSha, preRunHeadSha}` and tests prove the eligible push set is exactly `preRunHeadSha..HEAD` after safety checks.
- [ ] Agent-edits-only produces `fix: address PR review feedback`; agent-already-committed pushes only commits in `preRunHeadSha..HEAD`; no-change does not create an empty commit.
- [ ] Live PR open/merged-state and head checks run before auto-commit and before push, with `unsupported_target_state` for closed/merged targets and `stale_head` for head mismatch.
- [ ] No v1 path force-pushes, and no-change runs create no commit and perform no push.
- [ ] README explains setup, auth, main CLI flow, MCP flow, and one review-thread example.
- [ ] Docs cover MCP config, auth resolution, `PR_BABYSIT_WEBHOOK_SECRET`, mandatory webhook signatures, signed-forwarder compatibility, `--scope all|bots|humans` default/scope, fixture mode, `gh webhook forward` limitations, startup reconciliation and outcomes, repository binding from the target checkout/current branch upstream remote, same-repo PR limitation, git history safety, no-change behavior, and always-push safety semantics.
- [ ] `skills/babysit/SKILL.md` is a thin launcher for `pr-babysit watch "$ARGUMENTS"` and contains no `agent-reviews` path.

## Done summary
Implemented fail-closed git guard modules for clean worktree startup, baseline capture, upstream/pre-run head tracking, descendant checks, commit-on-change, and push guarding. Added README setup/CLI/MCP/watch docs, auth notes, webhook forwarding docs, always-push safety docs, and the thin `skills/babysit/SKILL.md` launcher delegating to `pr-babysit watch "$ARGUMENTS"`.

## Evidence
- `pnpm lint`
- `pnpm typecheck`
- `pnpm test`
- `pnpm build`
- `node dist/bin/pr-babysit.js --help`
