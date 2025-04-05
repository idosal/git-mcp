import { McpServer } from "@modelcontextprotocol/sdk/server/mcp";
import { RepoData } from "../../../shared/repoData.js";

export interface RepoHandler {
  name: string;
  registerTools(mcp: McpServer, repoData: RepoData): void;

  // For the generic MCP to call
  fetchDocumentation({ repoData }: { repoData: RepoData }): Promise<{
    fileUsed: string;
    content: { type: "text"; text: string }[];
  }>;

  // For the generic MCP to call
  searchRepositoryDocumentation({
    repoData,
    query,
  }: {
    repoData: RepoData;
    query: string;
  }): Promise<{
    searchQuery: string;
    content: { type: "text"; text: string }[];
  }>;
}
