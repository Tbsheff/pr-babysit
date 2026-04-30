# Auth

`pr-babysit` resolves GitHub auth in this order:

1. `GITHUB_TOKEN`
2. `gh auth token`
3. fail with `auth_failed`

Network watch mode also requires `PR_BABYSIT_WEBHOOK_SECRET`. The secret is used to verify `X-Hub-Signature-256` on local webhook deliveries. Fixture mode is file-based and does not require the webhook secret.
