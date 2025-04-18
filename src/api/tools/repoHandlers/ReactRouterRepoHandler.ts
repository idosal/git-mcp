import {
  fetchDocumentation,
  generateSearchToolDescription,
  generateSearchToolName,
  searchRepositoryDocumentation,
} from "../commonTools.js";
import type { RepoData } from "../../../shared/repoData.js";
import type { RepoHandler, Tool } from "./RepoHandler.js";
import { getDefaultRepoHandler } from "./DefaultRepoHandler.js";
import { z } from "zod";

class ReactRouterRepoHandler implements RepoHandler {
  name = "react-router";
  getTools(repoData: RepoData, env: any, ctx: any): Array<Tool> {
    // Get all default tools, including the search tool which uses Cloudflare Vectorize
    const defaultTools = getDefaultRepoHandler().getTools(repoData, env, ctx);
    const searchToolName = generateSearchToolName(repoData);
    const searchToolDescription = generateSearchToolDescription(repoData);

    // Create our custom search tool
    const searchTool = {
      name: searchToolName,
      description: searchToolDescription,
      paramsSchema: {
        query: z
          .string()
          .describe("The search query to find relevant documentation"),
      },
      cb: async ({ query }: { query: string }) => {
        return searchRepositoryDocumentation({
          repoData,
          query,
          env,
          ctx,
        });
      },
    };

    // Filter out the default search tool and add our specific implementation
    const filteredTools = defaultTools.filter(
      (tool) => tool.name !== searchToolName,
    );
    return [...filteredTools, searchTool];
  }

  async fetchDocumentation({
    repoData,
    env,
    ctx,
  }: {
    repoData: RepoData;
    env: Env;
    ctx: any;
  }): Promise<{
    fileUsed: string;
    content: { type: "text"; text: string }[];
  }> {
    return await fetchDocumentation({ repoData, env, ctx });
  }

  async searchRepositoryDocumentation({
    repoData,
    query,
    env,
    ctx,
  }: {
    repoData: RepoData;
    query: string;
    env: Env;
    ctx: any;
  }): Promise<{
    searchQuery: string;
    content: { type: "text"; text: string }[];
  }> {
    return await searchRepositoryDocumentation({
      repoData,
      query,
      env,
      ctx,
    });
  }
}

let reactRouterRepoHandler: ReactRouterRepoHandler;
export function getReactRouterRepoHandler(): ReactRouterRepoHandler {
  if (!reactRouterRepoHandler) {
    reactRouterRepoHandler = new ReactRouterRepoHandler();
  }
  return reactRouterRepoHandler;
}
