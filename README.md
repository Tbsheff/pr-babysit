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
