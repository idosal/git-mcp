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
    console.log("Base MyMCP initialized");
    const request: Request = this.props.request as Request;
    const host = request.headers.get("host");
    const protocol = host?.includes("localhost") ? "http" : "https";
    const adjustedUrl = new URL(request.url || "", `${protocol}://${host}`);

    if (!host || !adjustedUrl) {
      throw new Error("Invalid request: Missing host or URL");
    }

    // clean search params
    adjustedUrl.searchParams.forEach((value, key) => {
      if (key !== "sessionId") {
        adjustedUrl.searchParams.delete(key);
      }
    });
    // clean hash
    adjustedUrl.hash = "";
    const adjustedUrlString = adjustedUrl.toString();

    // Access env from this.env (Cloudflare worker environment is accessible here)
    const env = this.env;
    console.log(
      "Environment in init:",
      env ? "Available" : "Not available",
      env,
    );

    // Pass env to getMcpTools
    getMcpTools(host, adjustedUrlString, env).forEach((tool) => {
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
    // Check if the request has a transport header indicating SSE
    console.log("Request Headers:", request.headers);
    console.log("Request URL:", request.url);
    const isSse = request.headers.get("accept")?.includes("text/event-stream");
    const isMessage = request.url.includes("message");
    console.log("ctx", ctx);
    ctx.props.request = request;

    if (isMessage) {
      return await mcpHandler.fetch(request, env, ctx);
    }

    if (isSse) {
      const newHeaders = new Headers(request.headers);
      newHeaders.set("Content-Type", "text/event-stream");

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
