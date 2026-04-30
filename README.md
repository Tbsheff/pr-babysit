# pr-babysit

`pr-babysit` is a TypeScript CLI and MCP toolset for watching a GitHub pull request, running a local coding agent on review feedback, replying to review threads, resolving them, and pushing fixes.

This repository intentionally replaces `agent-reviews`; it does not wrap or depend on it.

## Current Slice

The scaffold provides:

- A strict TypeScript single-package layout.
- A `pr-babysit` executable entrypoint.
- Homes for the pure GitHub core, CLI, MCP, webhook, local agent runner, and test harness code.
- A replay-fixture loader for recorded webhook and GitHub-state scenarios.
- Disposable git repository helpers for safety tests.

## Commands

```bash
pnpm install
pnpm lint
pnpm typecheck
pnpm test
pnpm build
node dist/bin/pr-babysit.js --help
```

## CLI Flow

```bash
pr-babysit pr context OWNER/REPO#123
pr-babysit reviews list OWNER/REPO#123 --json
pr-babysit reviews reply-and-resolve OWNER/REPO#123 review-thread:PRRT_123 --expected-head abc123 --body "Fixed in abc123."
pr-babysit comments add OWNER/REPO#123 --expected-head abc123 --body "I pushed the fix."
pr-babysit checks list OWNER/REPO#123 --json
```

`reviews resolve` exists only for humans. Agent prompts and MCP tools expose reply-first operations instead.

## MCP Flow

```bash
pr-babysit mcp --target OWNER/REPO#123
```

See [MCP config examples](docs/mcp-config-examples.md).

## Watch Flow

Network watch mode requires a clean checked-out target worktree, GitHub auth, same-repo PR head, branch/upstream alignment, and `PR_BABYSIT_WEBHOOK_SECRET`.

```bash
export PR_BABYSIT_WEBHOOK_SECRET="$(openssl rand -hex 32)"
pr-babysit watch OWNER/REPO#123 --agent auto --scope all
```

Fixture mode skips network ingress and webhook forwarding:

```bash
pr-babysit watch OWNER/REPO#123 --fixture testdata/fixtures/review-comment-created.fixture.json
```

Scope defaults to `all`; `bots` and `humans` filter review-thread and PR conversation-comment author handling, not check/status reconciliation.

## Layout

```text
src/bin/        executable entrypoints
src/cli/        human and agent CLI command wiring
src/core/       pure GitHub review domain contracts
src/mcp/        agent-safe MCP server boundaries
src/webhooks/   webhook normalization and fixture replay boundaries
src/agents/     privileged local agent runner boundaries
src/testing/    hermetic fixture and git safety harnesses
testdata/       recorded fixture inputs
tests/          Vitest coverage for scaffold behavior
```

## Safety Boundary

MCP code must remain agent-safe and must not expose shell, git, or arbitrary local runner capabilities. Privileged git and agent execution belong under `src/agents` and later CLI watch code.

Additional docs:

- [Auth](docs/auth.md)
- [Webhook forwarding](docs/operations/gh-webhook-forwarding.md)
- [Always-push safety](docs/safety/always-push.md)
