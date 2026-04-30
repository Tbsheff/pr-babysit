---
satisfies: [R1, R7]
---

## Description
Bootstrap the greenfield project as a strict TypeScript package with one executable `pr-babysit` entrypoint, a small internal layout for shared core/CLI/MCP/webhooks/agents, and a hermetic fixture harness for git and webhook safety tests.

**Size:** M
**Files:** `package.json`, `tsconfig.json`, `src/bin/pr-babysit.ts`, `src/core/`, `src/cli/`, `src/mcp/`, `src/webhooks/`, `src/agents/`, `src/testing/fixtures/`, `testdata/`, `README.md`

## Approach
- Use a single-package layout first; do not introduce a monorepo until shared package boundaries are proven.
- Use strict TypeScript, explicit exports from concrete files, and no barrel exports.
- Add lint, typecheck, and Vitest scripts before feature code.
- Add a test harness that can create disposable git repos/remotes for dirty tree, detached head, upstream drift, and push rejection scenarios.
- Add a reusable fixture loader for the epic Fixture Mode schema: `target`, `startup`, `deliveries`, and keyed `snapshots`, including inline `payload` JSON, payload-path references, and ordered snapshot arrays for sequential refetch simulation.

## Investigation targets
**Required** (read before coding):
- `.flow/config.json:1` — Flow settings for this planning workspace.
- `.flow/meta.json:1` — confirms this is a fresh Flow seed.

## Key context
The current repo has no `package.json`, no `.git`, and an empty CodeDB snapshot. Safety-critical git behavior must be proven through disposable fixture repos, not the planning workspace itself.

## Acceptance
- [x] `pnpm lint`, `pnpm typecheck`, and `pnpm test` exist and pass on the scaffold.
- [x] `pr-babysit --help` runs through the built CLI entrypoint.
- [x] The package has no runtime dependency on `agent-reviews`.
- [x] The source layout has clear homes for pure GitHub review core, privileged local runner/git code, CLI commands, MCP tools, webhook handling, and agent code.
- [x] Test helpers can create disposable local repos/remotes for git safety scenarios.
- [x] Fixture helpers validate the concrete fixture schema, support startup snapshots, per-delivery `before`/`after` snapshots, inline `payload` JSON, payload-path references, ordered refetch snapshot arrays, and process-lost in-memory replay scenarios.

## Done summary
Implemented the strict TypeScript single-package scaffold with a built `pr-babysit` entrypoint, explicit source homes for CLI/core/MCP/webhooks/agents, Vitest/ESLint/typecheck scripts, fixture replay helpers, disposable git repository helpers, seed testdata, and README safety notes. The package has no runtime dependency on `agent-reviews`.

## Evidence
- `pnpm lint`
- `pnpm typecheck`
- `pnpm test`
- `pnpm build`
- `node dist/bin/pr-babysit.js --help`
