import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { getRepoData } from "../../shared/repoData.js";
import { getHandlerByRepoData } from "./repoHandlers/handlers.js";

export function registerTools(
  mcp: McpServer,
  requestHost: string,
  requestUrl?: string,
) {
  const repoData = getRepoData({ requestHost, requestUrl });
  const handler = getHandlerByRepoData(repoData);
  handler.registerTools(mcp, repoData);
}
