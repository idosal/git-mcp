import { McpServer } from "@modelcontextprotocol/sdk/server/mcp";
import { RepoHandler } from "./RepoHandler.js";
import { RepoData } from "../../../shared/repoData.js";
import { getDefaultRepoHandler } from "./DefaultRepoHandler.js";

class ThreejsRepoHandler implements RepoHandler {
  name = "threejs";
  registerTools(mcp: McpServer, repoData: RepoData): void {
    console.debug("Creating tools for threejs");
    return getDefaultRepoHandler().registerTools(mcp, repoData);
  }

  async fetchDocumentation({ repoData }: { repoData: RepoData }): Promise<{
    fileUsed: string;
    content: { type: "text"; text: string }[];
  }> {
    console.debug("Fetching documentation for threejs");
    return getDefaultRepoHandler().fetchDocumentation({ repoData });
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
    console.debug("Searching repository documentation for threejs");
    return getDefaultRepoHandler().searchRepositoryDocumentation({
      repoData,
      query,
    });
  }
}
let threejsRepoHandler: ThreejsRepoHandler;
export function getThreejsRepoHandler(): ThreejsRepoHandler {
  if (!threejsRepoHandler) {
    threejsRepoHandler = new ThreejsRepoHandler();
  }
  return threejsRepoHandler;
}
