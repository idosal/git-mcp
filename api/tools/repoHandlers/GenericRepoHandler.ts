import { McpServer } from "@modelcontextprotocol/sdk/server/mcp";
import { RepoData } from "../../../shared/repoData.js";
import { RepoHandler } from "./RepoHandler.js";
import { z } from "zod";
import { getHandlerByRepoData } from "./handlers.js";
import {
  fetchDocumentation,
  searchRepositoryDocumentation,
} from "../commonTools.js";

class GenericRepoHandler implements RepoHandler {
  name = "generic";
  registerTools(mcp: McpServer, repoData: RepoData): void {
    console.debug("Creating tools for docs page");
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
        // Use the existing logic but override the repo data to point to the specified repository
        const repoData: RepoData = {
          owner,
          repo,
          urlType: "github",
          host: "gitmcp.io",
        };
        const handler = getHandlerByRepoData(repoData);
        return handler.fetchDocumentation({ repoData });
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
        // Use the existing search logic but override the repo data to point to the specified repository
        const repoData: RepoData = {
          owner,
          repo,
          urlType: "github",
          host: "gitmcp.io",
        };
        const handler = getHandlerByRepoData(repoData);
        return handler.searchRepositoryDocumentation({ repoData, query });
      },
    );
  }

  async fetchDocumentation({ repoData }: { repoData: RepoData }): Promise<{
    fileUsed: string;
    content: { type: "text"; text: string }[];
  }> {
    return await fetchDocumentation({ repoData });
  }

  async searchRepositoryDocumentation({
    repoData,
    query,
  }: {
    repoData: RepoData;
    query: string;
  }): Promise<{
    searchQuery: string;
    content: { type: "text"; text: string }[];
  }> {
    return await searchRepositoryDocumentation({ repoData, query });
  }
}

let genericRepoHandler: GenericRepoHandler;
export function getGenericRepoHandler(): GenericRepoHandler {
  if (!genericRepoHandler) {
    genericRepoHandler = new GenericRepoHandler();
  }
  return genericRepoHandler;
}
