---
name: babysit
description: Watch a GitHub pull request with pr-babysit. Use when the user invokes /babysit or asks Codex to babysit a PR, monitor review feedback, run a local agent on webhook events, reply to and resolve review threads, push commits, and stop when the PR closes or merges. Accepts a PR URL, OWNER/REPO#NUMBER, PR number, or no argument from a PR branch.
---

# Babysit

Delegate all behavior to the `pr-babysit` CLI. Do not implement review handling in this skill.

Run:

```bash
pr-babysit watch "$ARGUMENTS"
```

If `pr-babysit` is not installed but this repository is the current working tree, build and run the local CLI:

```bash
pnpm install
pnpm build
node dist/bin/pr-babysit.js watch "$ARGUMENTS"
```

Rules:

- Do not call `agent-reviews`.
- Do not poll GitHub from the skill.
- Do not reply to or resolve review threads directly from the skill.
- Let `pr-babysit watch` own webhook forwarding, MCP tools, agent invocation, commits, pushes, and shutdown.
