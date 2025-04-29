import type { RepoData } from "../../../shared/repoData.js";
import type { RepoHandler, Tool } from "./RepoHandler.js";
import {
  fetchDocumentation,
  searchRepositoryDocumentation,
} from "../commonTools.js";

export class CloudflareRepoHandler implements RepoHandler {
  name = "cloudflare";
  fetchOverride(
    repoData: RepoData,
    request: Request,
  ): Promise<Response> | null {
    const url = new URL("https://docs.mcp.cloudflare.com/sse");
    const originalUrl = new URL(request.url);
    if (originalUrl.searchParams.get("sessionId")) {
      url.searchParams.set(
        "sessionId",
        originalUrl.searchParams.get("sessionId") || "",
      );
    }
    const newRequest = new Request(url.toString(), {
      body: request.body,
      headers: request.headers,
    });
    newRequest.headers.set("x-forwarded-host", "docs.mcp.cloudflare.com");
    return fetch(newRequest);
  }
  getTools(repoData: RepoData, env: any, ctx: any): Array<Tool> {
    return [];
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

let cloudflareRepoHandler: CloudflareRepoHandler;
export function getCloudflareRepoHandler(): CloudflareRepoHandler {
  if (!cloudflareRepoHandler) {
    cloudflareRepoHandler = new CloudflareRepoHandler();
  }
  return cloudflareRepoHandler;
}
