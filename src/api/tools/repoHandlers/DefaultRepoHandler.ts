import {
  fetchDocumentation,
  searchRepositoryDocumentation,
} from "../commonTools.js";
import { z } from "zod";
import type { RepoData } from "../../../shared/repoData.js";
import type { RepoHandler, Tool } from "./RepoHandler.js";

class DefaultRepoHandler implements RepoHandler {
  name = "default";
  getTools(repoData: RepoData, env: any): Array<Tool> {
    // Generate a dynamic description based on the URL
    const fetchToolName = generateFetchToolName(repoData);
    const fetchToolDescription = generateFetchToolDescription(repoData);
    const searchToolName = generateSearchToolName(repoData);
    const searchToolDescription = generateSearchToolDescription(repoData);

    return [
      {
        name: fetchToolName,
        description: fetchToolDescription,
        paramsSchema: {},
        cb: async () => {
          return fetchDocumentation({ repoData, env });
        },
      },
      {
        name: searchToolName,
        description: searchToolDescription,
        paramsSchema: {
          query: z
            .string()
            .describe("The search query to find relevant documentation"),
        },
        cb: async ({ query }) => {
          return searchRepositoryDocumentation({
            repoData,
            query,
            env,
          });
        },
      },
    ];
  }

  async fetchDocumentation({
    repoData,
    env,
  }: {
    repoData: RepoData;
    env: any;
  }): Promise<{
    fileUsed: string;
    content: { type: "text"; text: string }[];
  }> {
    return await fetchDocumentation({ repoData, env });
  }

  async searchRepositoryDocumentation({
    repoData,
    query,
    env,
  }: {
    repoData: RepoData;
    query: string;
    env: any;
  }): Promise<{
    searchQuery: string;
    content: { type: "text"; text: string }[];
  }> {
    return await searchRepositoryDocumentation({
      repoData,
      query,
      env,
    });
  }
}

let defaultRepoHandler: DefaultRepoHandler;
export function getDefaultRepoHandler(): DefaultRepoHandler {
  if (!defaultRepoHandler) {
    defaultRepoHandler = new DefaultRepoHandler();
  }
  return defaultRepoHandler;
}

/**
 * Generate a dynamic search tool name for the search_documentation tool based on the URL
 * @param requestHost - The host from the request
 * @param requestUrl - The full request URL (optional)
 * @returns A descriptive string for the tool name
 */
function generateSearchToolName({ urlType, owner, repo }: RepoData): string {
  try {
    // Default tool name as fallback
    let toolName = "search_documentation";
    if (urlType == "subdomain" || urlType == "github") {
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
  urlType,
  owner,
  repo,
}: RepoData): string {
  try {
    // Default description as fallback
    let description =
      "Semantically search within the fetched documentation for the current repository.";

    if (urlType == "subdomain") {
      description = `Semantically search within the fetched documentation from the ${owner}/${repo} GitHub Pages. Useful for specific queries. Don't call if you already used fetch_documentation.`;
    } else if (urlType == "github") {
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
  urlType,
  owner,
  repo,
}: RepoData): string {
  try {
    // Default description as fallback
    let description = "Fetch entire documentation for the current repository.";

    if (urlType == "subdomain") {
      description = `Fetch entire documentation file from the ${owner}/${repo} GitHub Pages. Useful for general questions.`;
    } else if (urlType == "github") {
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
function generateFetchToolName({ urlType, owner, repo }: RepoData): string {
  try {
    // Default tool name as fallback
    let toolName = "fetch_documentation";

    if (urlType == "subdomain" || urlType == "github") {
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
