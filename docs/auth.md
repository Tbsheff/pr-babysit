# Auth

`pr-babysit` resolves GitHub auth in this order:

1. `GITHUB_TOKEN`
2. `gh auth token`
3. fail with `auth_failed`

Network watch mode also requires a webhook secret. The secret is used to verify `X-Hub-Signature-256` on local webhook deliveries. Fixture mode is file-based and does not require the webhook secret.

The release installer runs:

```bash
pr-babysit setup secret
```

That creates `${XDG_CONFIG_HOME:-$HOME/.config}/pr-babysit/env` with `0600` permissions. `PR_BABYSIT_WEBHOOK_SECRET` in the process environment still wins when set.
