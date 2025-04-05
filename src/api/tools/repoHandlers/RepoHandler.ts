import type { RepoData } from "../../../shared/repoData.js";

export interface Tool {
  name: string;
  description: string;
  paramsSchema: any;
  cb: (args: any) => Promise<any>;
}

export interface RepoHandler {
  name: string;
  getTools(repoData: RepoData, env: any): Array<Tool>;

  // For the generic MCP to call
  fetchDocumentation({
    repoData,
    env,
  }: {
    repoData: RepoData;
    env?: any;
  }): Promise<{
    fileUsed: string;
    content: { type: "text"; text: string }[];
  }>;

  // For the generic MCP to call
  searchRepositoryDocumentation({
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
  }>;
}
