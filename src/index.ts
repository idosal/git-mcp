import { McpAgent } from "agents/mcp";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { getMcpTools } from "./api/tools";
import { createRequestHandler } from "react-router";
import { generateBadgeResponse } from "./api/utils/badge";
import { getRepoData } from "./shared/repoData";
import { handleR2TestSetup } from "./api/test-setup";

declare global {
  interface CloudflareEnvironment extends Env {
    CLOUDFLARE_ANALYTICS?: any;
    OPENAI_API_KEY?: string;
    ANTHROPIC_API_KEY?: string;
    XAI_API_KEY?: string;
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
      "Access-Control-Allow-Headers": "*",
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

  return generateBadgeResponse(0, color);
}
export class MyMCP extends McpAgent {
  server = new McpServer({
    name: "GitMCP",
    version: "1.1.0",
  });

  async init() {
    const requestUrl = this.props.requestUrl as string;
    const url = new URL(requestUrl);
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

    const env = this.env as CloudflareEnvironment;
    const ctx = this.ctx;

    const repoData = getRepoData({
      requestHost: host,
      requestUrl: canonicalUrl,
    });

    getMcpTools(env, host, canonicalUrl, ctx).forEach((tool) => {
      const cb = async (args: any) => tool.cb(args);
      // Annotations must come between paramsSchema and the callback;
      // McpServer.tool() ignores any argument after the callback.
      if (tool.annotations) {
        this.server.tool(
          tool.name,
          tool.description,
          tool.paramsSchema,
          tool.annotations,
          cb,
        );
      } else {
        this.server.tool(tool.name, tool.description, tool.paramsSchema, cb);
      }
    });
  }
}

// Export a request handler that checks the transport header
export default {
  async fetch(request: Request, env: any, ctx: any) {
    const url = new URL(request.url);
    const pathname = url.pathname;

    if (
      env.ENVIRONMENT === "test" &&
      request.method === "POST" &&
      pathname === "/api/setup-r2-for-tests"
    ) {
      return await handleR2TestSetup(env as CloudflareEnvironment);
    }

    // Handle CORS preflight requests
    if (request.method === "OPTIONS") {
      return handleCorsPreflightRequest();
    }

    // MCP clients probe these per RFC 9728 / RFC 8414 to discover OAuth
    // metadata. We don't require OAuth, so 404 lets clients fall through to
    // unauthenticated mode instead of routing into MyMCP and polluting logs.
    if (
      pathname === "/.well-known/oauth-protected-resource" ||
      pathname.startsWith("/.well-known/oauth-protected-resource/") ||
      pathname === "/.well-known/oauth-authorization-server" ||
      pathname.startsWith("/.well-known/oauth-authorization-server/")
    ) {
      return new Response("Not Found", { status: 404 });
    }

    // Handle badge requests
    if (pathname.startsWith("/badge/")) {
      const parts = pathname.split("/").filter(Boolean);
      if (parts.length >= 3 && parts[0] === "badge") {
        const owner = parts[1];
        const repo = parts[2];
        return handleBadgeRequest(request, env, owner, repo);
      }
    }

    const isStreamMethod =
      request.headers.get("accept")?.includes("text/event-stream") &&
      !!url.pathname &&
      url.pathname !== "/";

    ctx.props.requestUrl = request.url;

    if (isStreamMethod) {
      return await MyMCP.serve("/*").fetch(request, env, ctx);
    } else {
      // Default to serving the regular page
      return requestHandler(request, {
        cloudflare: { env, ctx },
      });
    }
  },
};
