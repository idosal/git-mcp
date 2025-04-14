import { fetchDocumentation, generateSearchToolName } from "../commonTools.js";
import type { RepoData } from "../../../shared/repoData.js";
import type { RepoHandler, Tool } from "./RepoHandler.js";
import { getDefaultRepoHandler } from "./DefaultRepoHandler.js";

class ReactRouterRepoHandler implements RepoHandler {
  name = "react-router";
  getTools(repoData: RepoData, env: any, ctx: any): Array<Tool> {
    const defaultTools = getDefaultRepoHandler().getTools(repoData, env, ctx);
    const searchToolName = generateSearchToolName(repoData);
    // filter out the search tool
    const tools = defaultTools.filter((tool) => tool.name !== searchToolName);
    return tools;
  }

  async fetchDocumentation({
    repoData,
    env,
    ctx,
  }: {
    repoData: RepoData;
    env: any;
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
    env: any;
    ctx: any;
  }): Promise<{
    searchQuery: string;
    content: { type: "text"; text: string }[];
  }> {
    const fetchResult = await fetchDocumentation({
      repoData,
      env,
      ctx,
    });
    return {
      searchQuery: query,
      content: fetchResult.content,
    };
  }
}

let reactRouterRepoHandler: ReactRouterRepoHandler;
export function getReactRouterRepoHandler(): ReactRouterRepoHandler {
  if (!reactRouterRepoHandler) {
    reactRouterRepoHandler = new ReactRouterRepoHandler();
  }
  return reactRouterRepoHandler;
}
