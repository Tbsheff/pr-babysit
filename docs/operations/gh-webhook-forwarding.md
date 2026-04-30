# GitHub Webhook Forwarding

Network watch mode is designed for local operation with `gh webhook forward`.

`pr-babysit watch` loads the webhook secret from `PR_BABYSIT_WEBHOOK_SECRET` or `${XDG_CONFIG_HOME:-$HOME/.config}/pr-babysit/env`. Internally it starts:

```bash
gh webhook forward \
  --repo OWNER/REPO \
  --events pull_request,pull_request_review,pull_request_review_comment,pull_request_review_thread,issue_comment,check_run,check_suite,workflow_run,status \
  --url http://127.0.0.1:8787/webhook \
  --secret "$PR_BABYSIT_WEBHOOK_SECRET"
```

V1 requires a forwarder that supports `--secret`; unsigned forwarding fails closed with `forwarder_unsigned`. Only one repo/org forwarder can be active for a given GitHub account/repo scope, so setup failures should be treated as operator-visible rather than retried silently.

Fixture mode skips the forwarder:

```bash
pr-babysit watch OWNER/REPO#123 --fixture testdata/fixtures/review-comment-created.fixture.json
```
