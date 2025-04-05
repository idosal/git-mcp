# GitMCP

<img width="1148" alt="image" src="https://github.com/user-attachments/assets/e0c719d2-62f4-450e-90f3-c7dd0194f0b9" />

<p align="center">
  <a href="#features">Features</a> •
  <a href="#usage">Usage</a> •
  <a href="#how-it-works">How It Works</a> •
  <a href="#examples">Examples</a> •
  <a href="#faq">FAQ</a> •
  <a href="#privacy">Privacy</a> •
  <a href="#contributing">Contributing</a> •
  <a href="#license">License</a>
</p>
<div align="center">

[![Twitter Follow](https://img.shields.io/twitter/follow/idosal1?style=social)](https://twitter.com/idosal1)
[![Twitter Follow](https://img.shields.io/twitter/follow/liadyosef?style=social)](https://twitter.com/liadyosef)
</div>

## What is GitMCP?

GitMCP is an intelligent documentation search tool that helps AI assistants better understand and search through GitHub project documentation. Key features:

- 🔍 **Smart Search**: Supports natural language queries to quickly find relevant content in project docs
- 📚 **Document Support**: Automatically retrieves `llms.txt` and `README.md` from your repository
- 🤖 **AI-Optimized**: Specifically designed for AI assistants to provide more accurate document understanding
- 🆓 **Completely Free**: Open-source project with no associated costs
- 🔒 **Privacy-Focused**: No personal information collected, no query history stored

### Use Cases

- Let AI assistants help you find specific content in project documentation
- Quickly locate installation and configuration instructions
- Search through API documentation and usage examples
- Access project best practices and guidelines

### Supported Documentation

GitMCP currently supports the following documents (in order of priority):
1. `llms.txt` - Documentation optimized for AI assistants
   - Follows the [llms.txt specification](https://llmstxt.org)
   - Provides structured, AI-friendly content
   - Recommended format for best search results
2. `README.md` - Project documentation

## Features

- **Empower AI with GitHub Project Access**: Direct your AI assistant to GitMCP for instant access to any GitHub project's documentation, complete with semantic search capabilities to optimize token usage.
- **Zero Setup Required**: No configurations or modifications needed — GitMCP works out of the box.
- **Completely Free and Private**: GitMCP is free. We don't collect any personally identifiable information or queries. Plus, you can host it yourself!

## Getting Started (Usage)

To make your GitHub repository accessible to AI assistants via GitMCP, use the following URL formats:

- For GitHub repositories: `gitmcp.io/{owner}/{repo}` 
- For GitHub Pages sites: `{owner}.gitmcp.io/{repo}`
- Dynamic endpoint: `gitmcp.io/docs`

Congratulations! The chosen GitHub project is now fully accessible to your AI.

Replace `{owner}` with your GitHub username or organization name and `{repo}` with your repository name. Once configured, your AI assistant can access the project's documentation seamlessly.
The dynamic endpoint doesn't require a pre-defined repository. When used, your AI assistant can dynamically input any GitHub repository to enjoy GitMCP's features.

<video src="https://github.com/user-attachments/assets/2c3afaf9-6c08-436e-9efd-db8710554430"></video>

## How It Works

GitMCP implements the [Model Context Protocol (MCP)](https://modelcontextprotocol.github.io/) to provide a standardized interface for AI assistants to access GitHub documentation. Here's how it works:

### Core Components
- **MCP Implementation**: 
  - Implements MCP server specification
  - Handles AI assistant requests
  - Manages documentation retrieval

- **Documentation Handler**:
  - Prioritizes `llms.txt` for AI-optimized content
  - Falls back to `README.md`
  - Supports semantic search capabilities

- **Search Engine**:
  - Vector-based semantic search
  - Keyword matching
  - Context-aware results

### Request Flow
1. AI assistant sends MCP request to GitMCP
2. GitMCP authenticates and retrieves documentation
3. Content is processed and indexed
4. Search results are returned in MCP format

## Examples

Here are some examples of how to use GitMCP with different repositories:

- **Example 1**: For the repository `https://github.com/octocat/Hello-World`, use: `https://gitmcp.io/octocat/Hello-World`
- **Example 2**: For the GitHub Pages site `langchain-ai.gitmcp.io/langgraph`, use: `https://langchain-ai.gitmcp.io/langgraph`
- **Example 3**: Use the generic `gitmcp.com/docs` endpoint for your AI to dynamically select a repository
- 
These URLs enable AI assistants to access and interact with the project's documentation through GitMCP.

## Tools

GitMCP provides a set of tools that can be used to access and interact with the project's documentation.

### `fetch_<repo-name>_documentation`: 
Fetches the documentation for the `{owner}/{repo}` GitHub repository (as extracted from the URL: `gitmcp.io/{owner}/{repo}` or `{owner}.gitmcp.io/{repo}`). Useful for general questions. Retrieves the `llms.txt` file and falls back to `README.md` or other pages if the former is unavailable.

### `search_<repo-name>_documentation`: 
It searches the repository's documentation by providing a `query`. This is useful for specific questions. It uses semantic search to find the most relevant documentation. This mitigates the cost of a large documentation set that cannot be provided as direct context to LLMs.

> Note: In the case of a generic `gitmcp.com/docs` usage, the tools are called `fetch_generic_documentation` and `search_generic_documentation`, and receive additional `owner` and `repo` arguments.

## FAQ

### What is the Model Context Protocol?

The [Model Context Protocol](https://modelcontextprotocol.github.io/) is a standard that allows AI assistants to request and receive additional context from external sources in a structured manner, enhancing their understanding and performance.

### Does GitMCP work with any AI assistant?

Yes, GitMCP is compatible with any AI assistant supporting the Model Context Protocol, including tools like Cursor, VSCode, Claude, etc.

### Is GitMCP compatible with all GitHub projects?

Absolutely! GitMCP works with any public GitHub repository without requiring any modifications. It prioritizes the `llms.txt` file and falls back to `README.md` or other pages if the former is unavailable. Future updates aim to support additional documentation methods and even generate content dynamically.

### Does GitMCP cost money?

No, GitMCP is a free service to the community with no associated costs.

## Privacy

GitMCP is deeply committed to its users' privacy. The service doesn't have access to or store any personally identifiable information as it doesn't require authentication. In addition, it doesn't store any queries sent by the agents. Moreover, as GitMCP is an open-source project, it can be deployed independently in your environment.

GitMCP only accesses content that is already publicly available and only when queried by a user. GitMCP does not automatically scrape repositories. Before accessing any GitHub Pages site, the code checks for `robots.txt` rules and follows the directives set by site owners, allowing them to opt out. Please note that GitMCP doesn't permanently store data regarding the GitHub projects or their content.

## Contributing

We welcome contributions! Please take a look at our [contribution](https://github.com/idosal/git-mcp/blob/main/.github/CONTRIBUTING.md) guidelines.

## License

This project is licensed under the [MIT License](LICENSE).

## Disclaimer

GitMCP is provided "as is" without warranty of any kind. While we strive to ensure the reliability and security of our service, we are not responsible for any damages or issues that may arise from its use. GitHub projects accessed through GitMCP are subject to their respective owners' terms and conditions. GitMCP is not affiliated with GitHub or any of the mentioned AI tools.
