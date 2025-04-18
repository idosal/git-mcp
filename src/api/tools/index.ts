import { z } from "zod";
import { getRepoData } from "../../shared/repoData.js";
import { fetchUrlContent } from "./commonTools.js";
import { getHandlerByRepoData } from "./repoHandlers/handlers.js";
import type { Tool } from "./repoHandlers/RepoHandler.js";

export function getMcpTools(
  env: Env,
  requestHost: string,
  requestUrl?: string,
  ctx?: any,
): Array<Tool> {
  const repoData = getRepoData({ requestHost, requestUrl });
  const handler = getHandlerByRepoData(repoData);
  const handlerTools = handler.getTools(repoData, env, ctx);
  return [
    ...handlerTools,
    {
      name: "fetch_url_content_with_robots_txt_check",
      description:
        "Generic tool to fetch content from a URL, respecting robots.txt rules. Use this to retrieve referenced documents or pages that were mentioned in previously fetched documentation.",
      paramsSchema: {
        url: z.string().describe("The URL of the document or page to fetch"),
      },
      cb: async ({ url }) => {
        return fetchUrlContent({ url, env });
      },
    },
  ];
}
