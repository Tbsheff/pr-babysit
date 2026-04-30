---
name: babysit
description: Watch a GitHub pull request with pr-babysit. Use when the user invokes /babysit or asks Codex to babysit a PR, monitor review feedback, run a local agent on webhook events, reply to and resolve review threads, push commits, and stop when the PR closes or merges. Accepts a PR URL, OWNER/REPO#NUMBER, PR number, or no argument to babysit the PR for the current branch.
---

# Babysit

Delegate all behavior to the `pr-babysit` CLI. Do not implement review handling in this skill.

Launch detached so the skill returns before host command timeouts. Use an explicit target when the user provided one; otherwise assume the PR for the current branch.

```bash
if [ -n "$ARGUMENTS" ]; then
  pr-babysit watch "$ARGUMENTS" --detach
else
  pr-babysit watch --detach
fi
```

If `pr-babysit` is not installed but this repository is the current working tree, build and run the local CLI:

```bash
pnpm install
pnpm build
if [ -n "$ARGUMENTS" ]; then
  node dist/bin/pr-babysit.js watch "$ARGUMENTS" --detach
else
  node dist/bin/pr-babysit.js watch --detach
fi
```

Rules:

- Do not call `agent-reviews`.
- Do not poll GitHub from the skill.
- Do not run `pr-babysit watch ""`.
- With no argument, run `pr-babysit watch --detach` so the CLI resolves the current branch PR.
- Do not run foreground watch from the skill; it is a long-lived daemon and will hit host timeouts.
- Do not reply to or resolve review threads directly from the skill.
- Let `pr-babysit watch` own webhook forwarding, MCP tools, agent invocation, commits, pushes, and shutdown.
