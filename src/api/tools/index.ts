import { getRepoData } from "../../shared/repoData.js";
import { getHandlerByRepoData } from "./repoHandlers/handlers.js";
import type { Tool } from "./repoHandlers/RepoHandler.js";

export function getMcpTools(
  requestHost: string,
  requestUrl?: string,
  env?: any,
): Array<Tool> {
  const repoData = getRepoData({ requestHost, requestUrl });
  const handler = getHandlerByRepoData(repoData);
  console.log("getMcpTools env", env);
  // Pass the env to the handler to make it available for tools that need it
  return handler.getTools(repoData, env);
}
