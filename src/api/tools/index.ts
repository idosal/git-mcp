import { getRepoData } from "../../shared/repoData.js";
import { getHandlerByRepoData } from "./repoHandlers/handlers.js";
import type { Tool } from "./repoHandlers/RepoHandler.js";

export function getMcpTools(
  requestHost: string,
  requestUrl?: string,
  env?: any,
  ctx?: any,
): Array<Tool> {
  const repoData = getRepoData({ requestHost, requestUrl });
  const handler = getHandlerByRepoData(repoData);
  return handler.getTools(repoData, env, ctx);
}
