import { MCPClientManager } from "agents/mcp/client";
import type { ToolSet } from "ai";

export async function getTools(urls: string[]) {
  const mcp = new MCPClientManager("my-agent", "1.0.0");
  let tools: ToolSet = {};
  for (const url of urls) {
    const { id } = await mcp.connect(url);
    if (mcp.mcpConnections[id]?.connectionState === "ready") {
      const mcptools = await mcp.unstable_getAITools();
      tools = { ...tools, ...mcptools };
    }
  }
  return tools;
}
