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

Bare mode is read-oriented. Mutating review and comment tools require `--target OWNER/REPO#NUMBER`.
