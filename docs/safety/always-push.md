# Always Push Safety

`watch` is intentionally sharp: when an agent successfully creates a commit, babysit pushes it. The safety contract is fail-closed:

- require a git worktree with an upstream
- record `{ upstreamSha, preRunHeadSha, preRunStatus }`
- allow dirty worktrees at startup
- commit only paths whose git status changed after `preRunStatus`
- push only commits in `preRunHeadSha..HEAD`
- never force-push
- stop on stale PR head, closed/merged PR, detached head, remote advancement, rewritten ancestry, non-descendant history, or push rejection
- create no empty commit when the agent makes no changes

Same-repo PR heads are supported in v1. Fork-head PRs are refused before agent execution.
