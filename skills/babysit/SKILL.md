---
name: babysit
description: Watch a GitHub pull request with pr-babysit. Use when the user invokes /babysit or asks Codex to babysit a PR, monitor review feedback, run a local agent on webhook events, reply to and resolve review threads, push commits, and stop when the PR closes or merges. Accepts a PR URL, OWNER/REPO#NUMBER, PR number, or no argument to babysit the PR for the current branch.
---

# Babysit

Prefer the MCP event loop when `pr-babysit` MCP tools are available. Use detached CLI watch only as a fallback.

MCP flow:

1. Use a `pr-babysit` MCP server started as `pr-babysit mcp --watch OWNER/REPO#NUMBER`.
2. Call `babysit.wait_for_event`.
3. When it returns an event, inspect review/check state with the review, comments, checks, and PR tools.
4. Make the required code changes in the current agent session.
5. Run targeted verification, commit, push, reply, and resolve.
6. Call `babysit.wait_for_event` again until the PR closes.

Do not spawn nested agents when MCP event tools are available.

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
- If `babysit.wait_for_event` is available, use it instead of shelling out to `watch --detach`.
- In fallback mode, let `pr-babysit watch` own webhook forwarding, agent invocation, commits, pushes, and shutdown.
