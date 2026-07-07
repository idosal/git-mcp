# Contributing to GitMCP

First of all, thank you for your interest in contributing to GitMCP! We appreciate the time and effort you're willing to invest in improving the project. This document provides guidelines and information to make the contribution process as smooth as possible.

## Table of Contents

- [Getting Started](#getting-started)
- [Local Development](#local-development)
  - [Prerequisites](#prerequisites)
  - [Setting Up Your Development Environment](#setting-up-your-development-environment)
  - [Running the Project Locally](#running-the-project-locally)
  - [Testing](#testing)
  - [Code Formatting](#code-formatting)
  - [Development Workflow](#development-workflow)
  - [Project Structure](#project-structure)
- [How to Contribute](#how-to-contribute)
  - [Reporting Bugs](#reporting-bugs)
  - [Suggesting Enhancements](#suggesting-enhancements)
  - [Submitting Pull Requests](#submitting-pull-requests)
- [Style Guidelines](#style-guidelines)
  - [Code Style](#code-style)
  - [Commit Messages](#commit-messages)
- [Additional Resources](#additional-resources)

## Getting Started

1. Fork the repository and clone it to your local machine.
2. Set up the development environment.
3. Explore the codebase, run tests, and verify that everything works as expected.

## Local Development

### Prerequisites

Before you start working on GitMCP, make sure you have the following installed:

- [Node.js](https://nodejs.org/) (version 18 or higher recommended)
- [pnpm](https://pnpm.io/) (version 9.0.0 or higher; lockfile v9)
- Git

### Setting Up Your Development Environment

1. Clone your forked repository:
   ```bash
   git clone https://github.com/your-username/git-mcp.git
   cd git-mcp
   ```

2. Install dependencies:
   ```bash
   pnpm install
   ```

3. Set up environment variables:
   - Create a `.env.local` file in the root directory
   - Add any necessary environment variables (ask project maintainers if you need access to specific API keys)

### Running the Project Locally

To start the development server:

```bash
pnpm vercel dev
```

This will start the Next.js development server, typically at http://localhost:3000.

For running with the MCP Inspector (useful for debugging MCP endpoints):

```bash
pnpm run inspector
```

### Testing

To run tests:

```bash
pnpm test
```

GitMCP uses Vitest as the testing framework. When adding new features, please include appropriate tests.

### Code Formatting

GitMCP uses Prettier for code formatting and lint-staged to ensure code is properly formatted before committing. Pre-commit hooks are set up with Husky to run these checks automatically.

To manually format your code:

```bash
pnpm prettier --write .
```

### Development Workflow

1. Create a new branch for your feature/bugfix
2. Make your changes
3. Add tests for your changes when applicable
4. Run the tests to ensure they pass
5. Commit your changes following the commit message guidelines
6. Push your branch and open a pull request

### Project Structure

- `api/`: Contains the server-side code and MCP implementation
  - `tools/`: MCP tools implementation
  - `utils/`: Utility functions for the API
- `app/`: Next.js app directory with React components
- `pages/`: Additional Next.js pages
- `public/`: Static assets
- `shared/`: Shared utilities used across the codebase

## How to Contribute

### Reporting Bugs

If you encounter a bug or issue while using GitMCP, please open a new issue on the [GitHub Issues](https://github.com/idosal/git-mcp/issues) page. Provide a clear and concise description of the problem, steps to reproduce it, and any relevant error messages or logs.

### Suggesting Enhancements

We welcome ideas for improvements and new features. To suggest an enhancement, open a new issue on the [GitHub Issues](https://github.com/idosal/git-mcp/issues) page. Describe the enhancement in detail, explain the use case, and outline the benefits it would bring to the project.

### Submitting Pull Requests

1. Create a new branch for your feature or bugfix. Use a descriptive name like `feature/your-feature-name` or `fix/your-bugfix-name`.
2. Make your changes, following the [Style Guidelines](#style-guidelines) below.
3. Test your changes and ensure that they don't introduce new issues or break existing functionality.
4. Commit your changes, following the [commit message guidelines](#commit-messages).
5. Push your branch to your fork on GitHub.
6. Open a new pull request against the `main` branch of the Wolverine repository. Include a clear and concise description of your changes, referencing any related issues.

## Style Guidelines

### Code Style

GitMCP uses [ESLint](https://eslint.org/) as its code style guide. Please ensure that your code follows these guidelines. 

### Commit Messages

Write clear and concise commit messages that briefly describe the changes made in each commit. Use the imperative mood and start with a capitalized verb, e.g., "Add new feature" or "Fix bug in function".

## Additional Resources

- [GitHub Help](https://help.github.com/)
- [GitHub Pull Request Documentation](https://docs.github.com/en/github/collaborating-with-issues-and-pull-requests)
- [ESLint Style Guide](https://eslint.org/)

Thank you once again for your interest in contributing to GitMCP. We look forward to collaborating with you and creating an even better project together!

