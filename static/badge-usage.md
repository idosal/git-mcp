# GitMCP Documentation View Badge

Add a view counter badge to your repository to show how many times your documentation has been viewed through GitMCP.

## How to Add the Badge to Your Repository

Add the following markdown to your `README.md` file:

```markdown
[![GitMCP Docs Views](https://img.shields.io/endpoint?url=https://gitmcp.io/badge/OWNER/REPO)](https://gitmcp.io/badge/OWNER/REPO)
```

Replace `OWNER` with your GitHub username or organization name, and `REPO` with your repository name.

## How We Count Views

The counter increments directly at the core function level:

1. **Documentation Fetching**: When `fetchDocumentation()` is called for your repository
2. **Documentation Search**: When `searchRepositoryDocumentation()` is called for your repository
3. **Code Search**: When `searchRepositoryCode()` is called for your repository

This implementation ensures precise tracking at the fundamental function level, providing an accurate picture of how AI assistants are using your repository through GitMCP's tools.

## High-Performance, Reliable Count Implementation

We use Cloudflare Durable Objects to ensure accurate counting even under high concurrent access. Our implementation includes:

1. **Atomic Operations**: Prevents race conditions that can happen with traditional key-value store implementations
2. **Write Buffering**: Uses a 5-second buffer window to batch counter increments, reducing storage operations and improving performance
3. **Fault Tolerance**: Ensures that count operations never impact the performance or reliability of the core tools
4. **Auto-Recovery**: The system automatically recovers from temporary failures and ensures counts are eventually consistent

The counter is fully atomic and distributed, providing consistent counts in a high-concurrency environment with minimal performance overhead.

## Customizing Your Badge

You can customize the appearance of your badge by adding the following parameters to the badge URL:

| Parameter | Description | Default | Example |
|-----------|-------------|---------|---------|
| `label` | Text for the badge label | `GitMCP` | `?label=Docs` |
| `color` | Color for the badge value | `blue` | `?color=green` |

For example, to create a badge with a custom label and color:

```markdown
[![GitMCP Docs](https://img.shields.io/endpoint?url=https://gitmcp.io/badge/OWNER/REPO?label=Docs&color=green)](https://gitmcp.io/badge/OWNER/REPO)
```

## How It Works

The GitMCP badge tracks function calls that access your repository data. Every time your repository is accessed through one of the core API functions in GitMCP, the counter is incremented atomically in a memory buffer. These increments are then periodically flushed to persistent storage every 5 seconds to optimize performance.

The view counts are updated in real time in memory, and persisted efficiently in batches. The badge itself may be cached for up to 5 minutes by shields.io and browsers.

## Technical Details

For those interested in the implementation:

1. Counter increments are collected in an in-memory buffer within a Durable Object
2. The buffer is flushed to persistent storage:
   - Every 5 seconds
   - When explicitly requested via admin endpoint
   - Before Durable Object shutdown/hibernation
3. Count lookups always return the sum of persistent counts plus any buffered increments
4. All operations have timeouts and fail-safe mechanisms to ensure reliability

## Examples

Here are some examples of customized badges:

- Default badge:  
  ![GitMCP Docs Views](https://img.shields.io/endpoint?url=https://gitmcp.io/badge/example/repo)

- Custom label:  
  ![GitMCP Docs](https://img.shields.io/endpoint?url=https://gitmcp.io/badge/example/repo?label=Docs)

- Custom color:  
  ![GitMCP Docs Views](https://img.shields.io/endpoint?url=https://gitmcp.io/badge/example/repo?color=orange)

- Custom label and color:  
  ![Documentation](https://img.shields.io/endpoint?url=https://gitmcp.io/badge/example/repo?label=Documentation&color=green) 