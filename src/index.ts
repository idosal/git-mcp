import { McpAgent } from "agents/mcp";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { getMcpTools } from "./api/tools";
import { createRequestHandler } from "react-router";
import {
  generateBadgeResponse,
  getRepoViewCount,
  withViewTracking,
} from "./api/utils/badge";
import { getRepoData } from "./shared/repoData";

export { ViewCounterDO } from "./api/utils/ViewCounterDO";

declare global {
  interface CloudflareEnvironment extends Env {
    CLOUDFLARE_ANALYTICS?: any;
    VIEW_COUNTER: DurableObjectNamespace;
  }
}

declare module "react-router" {
  export interface AppLoadContext {
    cloudflare: {
      env: CloudflareEnvironment;
      ctx: ExecutionContext;
    };
  }
}

const requestHandler = createRequestHandler(
  () => import("virtual:react-router/server-build"),
  import.meta.env.MODE,
);

// Create CORS preflight response
const handleCorsPreflightRequest = (): Response => {
  return new Response(null, {
    status: 204, // No content
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type",
      "Access-Control-Allow-Credentials": "true",
      "Access-Control-Max-Age": "86400", // 24 hours
    },
  });
};

// Handle badge request for repository
async function handleBadgeRequest(
  request: Request,
  env: CloudflareEnvironment,
  owner: string,
  repo: string,
): Promise<Response> {
  const url = new URL(request.url);
  const color = url.searchParams.get("color") || "aquamarine";

  const count = await getRepoViewCount(env, owner, repo);
  return generateBadgeResponse(count, color);
}
export class MyMCP extends McpAgent {
  server = new McpServer({
    name: "GitMCP",
    version: "1.0.0",
  });

  async init() {
    const request: Request = this.props.request as Request;
    const url = new URL(request.url);
    const host = url.host;

    if (!url || !host) {
      throw new Error("Invalid request: Missing host or URL");
    }

    // clean search params
    url.searchParams.forEach((_, key) => {
      if (key !== "sessionId") {
        url.searchParams.delete(key);
      }
    });
    // clean hash
    url.hash = "";
    const canonicalUrl = url.toString();

    // Access env from this.env (Cloudflare worker environment is accessible here)
    const env = this.env as CloudflareEnvironment;
    const ctx = this.ctx;

    // Get the repository data from the URL
    const repoData = getRepoData({
      requestHost: host,
      requestUrl: canonicalUrl,
    });

    // Pass env to getMcpTools
    getMcpTools(env, host, canonicalUrl, ctx).forEach((tool) => {
      this.server.tool(
        tool.name,
        tool.description,
        tool.paramsSchema,
        // Wrap the callback with view tracking
        withViewTracking(env, ctx, repoData, async (args: any) => {
          return tool.cb(args);
        }),
      );
    });
  }
}

const mcpHandler = MyMCP.mount("/*");

// Export a request handler that checks the transport header
export default {
  async fetch(request: Request, env: any, ctx: any) {
    // Handle CORS preflight requests
    if (request.method === "OPTIONS") {
      return handleCorsPreflightRequest();
    }

    const url = new URL(request.url);
    const pathname = url.pathname;

    // Handle badge requests
    if (pathname.startsWith("/badge/")) {
      // Extract owner and repo from URL pattern: /badge/:owner/:repo
      const parts = pathname.split("/").filter(Boolean);
      if (parts.length >= 3 && parts[0] === "badge") {
        const owner = parts[1];
        const repo = parts[2];
        return handleBadgeRequest(request, env, owner, repo);
      }
    }

    const isSse =
      request.headers.get("accept")?.includes("text/event-stream") &&
      !!url.pathname &&
      url.pathname !== "/";
    const isMessage =
      request.method === "POST" &&
      url.pathname.includes("/message") &&
      url.pathname !== "/message";
    ctx.props.request = request;

    if (isMessage) {
      return await mcpHandler.fetch(request, env, ctx);
    }

    if (isSse) {
      const newHeaders = new Headers(request.headers);
      if (!newHeaders.has("accept")) {
        newHeaders.set("Content-Type", "text/event-stream");
      }

      const modifiedRequest = new Request(request, {
        headers: newHeaders,
      });

      // Handle SSE request with MCP handler
      return await mcpHandler.fetch(modifiedRequest, env, ctx);
    } else {
      // Default to serving the regular page
      return requestHandler(request, {
        cloudflare: { env, ctx },
      });
    }
  },
};
