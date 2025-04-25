import { getModel } from "~/chat/ai/providers.server";
import type { modelID } from "~/chat/ai/providers.shared";
import { streamText, type ToolSet, type UIMessage } from "ai";

import type { StorageKey } from "~/chat/ai/providers.shared";
import { MCPClientManager } from "agents/mcp/client";

// Allow streaming responses up to 30 seconds
export const maxDuration = 60;

interface KeyValuePair {
  key: string;
  value: string;
}

interface MCPServerConfig {
  url: string;
  type: "sse" | "stdio";
  command?: string;
  args?: string[];
  env?: KeyValuePair[];
  headers?: KeyValuePair[];
}

export async function action({
  request,
  context,
}: {
  request: Request;
  context: any;
}) {
  const {
    messages,
    selectedModel,
    mcpServers = [],
    apiKeys,
  }: {
    messages: UIMessage[];
    selectedModel: modelID;
    mcpServers?: MCPServerConfig[];
    apiKeys: Record<StorageKey, string>;
  } = await request.json();

  const env = context.cloudflare.env as CloudflareEnvironment;
  const model = getModel(env, apiKeys);

  // // Initialize tools
  // let tools = {};
  // const mcpClients: any[] = [];

  // // Process each MCP server configuration
  // for (const mcpServer of mcpServers) {
  //   try {
  //     // Create appropriate transport based on type
  //     let transport:
  //       | MCPTransport
  //       | { type: "sse"; url: string; headers?: Record<string, string> };

  //     if (mcpServer.type === "sse") {
  //       // Convert headers array to object for SSE transport
  //       const headers: Record<string, string> = {};
  //       if (mcpServer.headers && mcpServer.headers.length > 0) {
  //         mcpServer.headers.forEach((header) => {
  //           if (header.key) headers[header.key] = header.value || "";
  //         });
  //       }

  //       transport = {
  //         type: "sse" as const,
  //         url: mcpServer.url,
  //         headers: Object.keys(headers).length > 0 ? headers : undefined,
  //       };
  //     } else {
  //       console.warn(
  //         `Skipping MCP server with unsupported transport type: ${mcpServer.type}`,
  //       );
  //       continue;
  //     }

  //     const mcpClient = await createMCPClient({ transport });
  //     mcpClients.push(mcpClient);

  //     const mcptools = await mcpClient.tools();
  //     console.log("mcptools", mcptools);

  //     console.log(
  //       `MCP tools from ${mcpServer.type} transport:`,
  //       Object.keys(mcptools),
  //     );

  //     // Add MCP tools to tools object
  //     tools = { ...tools, ...mcptools };
  //   } catch (error) {
  //     console.error("Failed to initialize MCP client:", error);
  //     // Continue with other servers instead of failing the entire request
  //   }
  // }

  // // Register cleanup for all clients
  // if (mcpClients.length > 0) {
  //   request.signal.addEventListener("abort", async () => {
  //     for (const client of mcpClients) {
  //       try {
  //         await client.close();
  //       } catch (error) {
  //         console.error("Error closing MCP client:", error);
  //       }
  //     }
  //   });
  // }

  let tools: ToolSet = {};
  const mcp = new MCPClientManager("my-agent", "1.0.0");
  for (const originalUrl of mcpServers.map((mcpServer) => mcpServer.url)) {
    const url = originalUrl.replace(
      "https://gitmcp.io",
      "https://git-mcp.idosalomon.workers.dev",
    );
    try {
      const { id } = await mcp.connect(url);
      if (mcp.mcpConnections[id]?.connectionState === "ready") {
        const mcptools = await mcp.unstable_getAITools();
        tools = { ...tools, ...mcptools };
      }
    } catch (error) {
      console.error("Error getting tools for url", url, error);
    }
  }

  // console.log("messages", messages);
  // console.log(
  //   "parts",
  //   messages.map((m) => m.parts.map((p) => p)),
  // );

  // If there was an error setting up MCP clients but we at least have composio tools, continue
  const result = streamText({
    model: model.languageModel(selectedModel),
    system: `You are a helpful assistant with access to a variety of tools.

    Today's date is ${new Date().toISOString().split("T")[0]}.

    The tools are very powerful, and you can use them to answer the user's question.
    So choose the tool that is most relevant to the user's question.

    If tools are not available, say you don't know or if the user wants a tool they can add one from the server icon in bottom left corner in the sidebar.

    You can use multiple tools in a single response.
    Always respond after using the tools for better user experience.
    You can run multiple steps using all the tools!!!!
    Make sure to use the right tool to respond to the user's question.

    Multiple tools can be used in a single response and multiple steps can be used to answer the user's question.

    ## Response Format
    - Markdown is supported.
    - Respond according to tool's response.
    - Use the tools to answer the user's question.
    - If you don't know the answer, use the tools to find the answer or say you don't know.
    `,
    messages,
    tools,
    maxSteps: 20,
    providerOptions: {
      google: {
        thinkingConfig: {
          thinkingBudget: 2048,
        },
      },
      anthropic: {
        thinking: {
          type: "enabled",
          budgetTokens: 12000,
        },
      },
    },
    onError: (error) => {
      console.error(JSON.stringify(error, null, 2));
    },
  });

  result.consumeStream();
  return result.toDataStreamResponse({
    sendReasoning: true,
    getErrorMessage: (error) => {
      if (error instanceof Error) {
        if (error.message.includes("Rate limit")) {
          return "Rate limit exceeded. Please try again later.";
        }
      }
      if (error instanceof Error) {
        if (error.name === "AI_LoadAPIKeyError") {
          return (
            error.message.split(".")[0] +
            ". Please add an API key in the settings."
          );
        }
      }
      const message =
        error instanceof Error ? error.message : "An error occurred.";
      console.error(error);
      return message;
    },
  });
}
