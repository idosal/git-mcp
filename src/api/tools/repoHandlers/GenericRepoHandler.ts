import type { RepoData } from "../../../shared/repoData.js";
import type { RepoHandler, Tool } from "./RepoHandler.js";
import { z } from "zod";
import {
  fetchDocumentation,
  searchRepositoryDocumentation,
} from "../commonTools.js";

class GenericRepoHandler implements RepoHandler {
  name = "generic";
  getTools(_: RepoData, env?: any): Array<Tool> {
    console.debug("Creating tools for docs page");

    return [
      {
        name: "fetch_generic_documentation",
        description:
          "Fetch documentation for any GitHub repository by providing owner and project name",
        paramsSchema: {
          owner: z
            .string()
            .describe("The GitHub repository owner (username or organization)"),
          repo: z.string().describe("The GitHub repository name"),
        },
        cb: async ({ owner, repo }) => {
          const repoData: RepoData = {
            owner,
            repo,
            urlType: "github",
            host: "gitmcp.io",
          };
          return fetchDocumentation({ repoData, env });
        },
      },
      {
        name: "search_generic_documentation",
        description:
          "Search within documentation for any GitHub repository by providing owner, project name, and search query",
        paramsSchema: {
          owner: z
            .string()
            .describe("The GitHub repository owner (username or organization)"),
          repo: z.string().describe("The GitHub repository name"),
          query: z
            .string()
            .describe("The search query to find relevant documentation"),
        },
        cb: async ({ owner, repo, query }) => {
          const repoData: RepoData = {
            owner,
            repo,
            urlType: "github",
            host: "gitmcp.io",
          };
          return searchRepositoryDocumentation({ repoData, query, env });
        },
      },
    ];
  }

  async fetchDocumentation({
    repoData,
    env,
  }: {
    repoData: RepoData;
    env?: any;
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
    env?: any;
  }): Promise<{
    searchQuery: string;
    content: { type: "text"; text: string }[];
  }> {
    return await searchRepositoryDocumentation({ repoData, query, env });
  }
}

let genericRepoHandler: GenericRepoHandler;
export function getGenericRepoHandler(): GenericRepoHandler {
  if (!genericRepoHandler) {
    genericRepoHandler = new GenericRepoHandler();
  }
  return genericRepoHandler;
}
