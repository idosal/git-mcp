---
name: git-mcp
description: Use GitMCP to access up-to-date GitHub project documentation and source code, eliminating code hallucinations.
---

# GitMCP for Codex

Access up-to-date documentation and source code from any GitHub project through the GitMCP remote MCP server.

## When to use

- You need current API docs, code examples, or usage patterns from a GitHub repo
- The user references a library or framework you want accurate information about
- You need to verify your knowledge against the actual source code

## Available servers

- **gitmcp (generic):** `https://gitmcp.io/docs` - AI picks the repo from context
- **Per-repo:** `https://gitmcp.io/{owner}/{repo}` - Scoped to a specific repository

## Tips

- For common libraries, the generic server works well
- For lesser-known or private repos, use the per-repo URL
- Combine with file reading for hybrid local + remote research
