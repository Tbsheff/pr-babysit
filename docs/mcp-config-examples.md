# MCP Config Examples

Bound agent mode:

```json
{
  "mcpServers": {
    "pr-babysit": {
      "command": "pr-babysit",
      "args": ["mcp", "--target", "OWNER/REPO#123"],
      "env": {
        "GITHUB_TOKEN": "${GITHUB_TOKEN}"
      }
    }
  }
}
```

Same-agent event mode:

```json
{
  "mcpServers": {
    "pr-babysit": {
      "command": "pr-babysit",
      "args": ["mcp", "--watch", "OWNER/REPO#123"],
      "env": {
        "GITHUB_TOKEN": "${GITHUB_TOKEN}"
      }
    }
  }
}
```

Then the agent can call `babysit.wait_for_event` to receive GitHub review/check events in the current session.

Bare inspector mode:

```json
{
  "mcpServers": {
    "pr-babysit": {
      "command": "pr-babysit",
      "args": ["mcp"]
    }
  }
}
```

Bare mode is read-oriented. Mutating review and comment tools require `--target OWNER/REPO#NUMBER` or `--watch OWNER/REPO#NUMBER`.
