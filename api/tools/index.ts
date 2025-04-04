import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { getRepoData, RepoData } from "../../shared/repoData.js";
import {
  fetchDocumentation,
  searchRepositoryDocumentation,
} from "./fetchAndSearch.js";

export function registerTools(
  mcp: McpServer,
  requestHost: string,
  requestUrl?: string,
) {
  // Generate a dynamic description based on the URL
  const repoData = getRepoData(requestHost, requestUrl);

  const isDocsPage =
    requestHost === "gitmcp.io" && repoData.owner === "docs" && !repoData.repo;
  if (isDocsPage) {
    console.log("Creating tools for docs page", repoData);
    mcp.tool(
      "fetch_generic_documentation",
      "Fetch documentation for any GitHub repository by providing owner and project name",
      {
        owner: z
          .string()
          .describe("The GitHub repository owner (username or organization)"),
        repo: z.string().describe("The GitHub repository name"),
      },
      async ({ owner, repo }) => {
        // Use the existing logic but override the URL to point to the specified repository
        return fetchDocumentation({
          requestHost: "gitmcp.io",
          requestUrl: `/${owner}/${repo}`,
        });
      },
    );

    // Also register a search tool for generic documentation
    mcp.tool(
      "search_generic_documentation",
      "Search within documentation for any GitHub repository by providing owner, project name, and search query",
      {
        owner: z
          .string()
          .describe("The GitHub repository owner (username or organization)"),
        repo: z.string().describe("The GitHub repository name"),
        query: z
          .string()
          .describe("The search query to find relevant documentation"),
      },
      async ({ owner, repo, query }) => {
        // Use the existing search logic but override the URL to point to the specified repository
        return searchRepositoryDocumentation({
          requestHost: "gitmcp.io",
          requestUrl: `/${owner}/${repo}`,
          query,
        });
      },
    );
    return;
  }

  const description = generateFetchToolDescription(repoData);
  const toolName = generateFetchToolName(repoData);
  const searchToolName = generateSearchToolName(repoData);
  const searchDescription = generateSearchToolDescription(repoData);

  // Register fetch documentation tool
  mcp.tool(toolName, description, {}, async () => {
    return fetchDocumentation({ requestHost, requestUrl });
  });

  // Register search documentation tool
  mcp.tool(
    searchToolName,
    searchDescription,
    {
      query: z
        .string()
        .describe("The search query to find relevant documentation"),
    },
    async ({ query }) => {
      return searchRepositoryDocumentation({ requestHost, requestUrl, query });
    },
  );
}

/**
 * Generate a dynamic search tool name for the search_documentation tool based on the URL
 * @param requestHost - The host from the request
 * @param requestUrl - The full request URL (optional)
 * @returns A descriptive string for the tool name
 */
function generateSearchToolName({
  subdomain,
  path,
  owner,
  repo,
}: RepoData): string {
  try {
    // Default tool name as fallback
    let toolName = "search_documentation";

    if (subdomain && path) {
      toolName = `search_${path}_documentation`;
    } else if (owner && repo) {
      toolName = `search_${repo}_documentation`;
    }

    // replace non-alphanumeric characters with underscores
    return toolName.replace(/[^a-zA-Z0-9]/g, "_");
  } catch (error) {
    console.error("Error generating search tool name:", error);
    // Return default tool name if there's any error parsing the URL
    return "search_documentation";
  }
}

/**
 * Generate a dynamic description for the search_documentation tool based on the URL
 * @param requestHost - The host from the request
 * @param requestUrl - The full request URL (optional)
 * @returns A descriptive string for the tool
 */
function generateSearchToolDescription({
  subdomain,
  path,
  owner,
  repo,
}: RepoData): string {
  try {
    // Default description as fallback
    let description =
      "Semantically search within the fetched documentation for the current repository.";

    if (subdomain && path) {
      description = `Semantically search within the fetched documentation from the ${subdomain}/${path} GitHub Pages. Useful for specific queries. Don't call if you already used fetch_documentation.`;
    } else if (owner && repo) {
      description = `Semantically search within the fetched documentation from GitHub repository: ${owner}/${repo}. Useful for specific queries. Don't call if you already used fetch_documentation.`;
    }

    return description;
  } catch (error) {
    // Return default description if there's any error parsing the URL
    return "Search documentation for the current repository.";
  }
}

/**
 * Generate a dynamic description for the fetch_documentation tool based on the URL
 * @param requestHost - The host from the request
 * @param requestUrl - The full request URL (optional)
 * @returns A descriptive string for the tool
 */
function generateFetchToolDescription({
  subdomain,
  path,
  owner,
  repo,
}: RepoData): string {
  try {
    // Default description as fallback
    let description = "Fetch entire documentation for the current repository.";

    if (subdomain && path) {
      description = `Fetch entire documentation file from the ${subdomain}/${path} GitHub Pages. Useful for general questions.`;
    } else if (owner && repo) {
      description = `Fetch entire documentation file from GitHub repository: ${owner}/${repo}. Useful for general questions.`;
    }

    return description;
  } catch (error) {
    // Return default description if there's any error parsing the URL
    return "Fetch documentation for the current repository.";
  }
}

/**
 * Generate a dynamic tool name for the fetch_documentation tool based on the URL
 * @param requestHost - The host from the request
 * @param requestUrl - The full request URL (optional)
 * @returns A descriptive string for the tool
 */
function generateFetchToolName({
  subdomain,
  path,
  owner,
  repo,
}: RepoData): string {
  try {
    // Default tool name as fallback
    let toolName = "fetch_documentation";

    if (subdomain && path) {
      toolName = `fetch_${path}_documentation`;
    } else if (owner && repo) {
      toolName = `fetch_${repo}_documentation`;
    }

    // replace non-alphanumeric characters with underscores
    return toolName.replace(/[^a-zA-Z0-9]/g, "_");
  } catch (error) {
    console.error("Error generating tool name:", error);
    // Return default tool name if there's any error parsing the URL
    return "fetch_documentation";
  }
}
