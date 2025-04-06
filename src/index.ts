import { McpAgent } from "agents/mcp";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { getMcpTools } from "./api/tools";
import { createRequestHandler } from "react-router";

declare global {
  interface CloudflareEnvironment extends Env {}
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
    const env = this.env;

    // Pass env to getMcpTools
    getMcpTools(host, canonicalUrl, env).forEach((tool) => {
      this.server.tool(
        tool.name,
        tool.description,
        tool.paramsSchema,
        async (args: any) => {
          return tool.cb(args);
        },
      );
    });
  }
}

const mcpHandler = MyMCP.mount("*");

// Export a request handler that checks the transport header
export default {
  async fetch(request: Request, env: any, ctx: any) {
    const url = new URL(request.url);
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
