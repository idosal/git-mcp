import type { RepoData } from "../../../shared/repoData.js";

export interface Tool {
  name: string;
  description: string;
  paramsSchema: any;
  cb: (args: any) => Promise<any>;
}

export interface RepoHandler {
  name: string;
  getTools(repoData: RepoData, env: any, ctx: any): Array<Tool>;

  // For the generic MCP to call
  fetchDocumentation({
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
  }>;

  // For the generic MCP to call
  searchRepositoryDocumentation({
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
  }>;
}
