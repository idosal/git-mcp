import {
  fetchDocumentation,
  searchRepositoryDocumentation,
  searchRepositoryCode,
  fetchUrlContent,
  generateFetchToolName,
  generateFetchToolDescription,
  generateSearchToolName,
  generateSearchToolDescription,
  generateCodeSearchToolName,
  generateCodeSearchToolDescription,
} from "../commonTools.js";
import { z } from "zod";
import type { RepoData } from "../../../shared/repoData.js";
import type { RepoHandler, Tool } from "./RepoHandler.js";
import { fetchNode } from "./graphTools.js";
import { FalkorDB, Graph } from "falkordb";
import net from "net";
if (typeof net.Socket.prototype.setNoDelay !== "function") {
  net.Socket.prototype.setNoDelay = function () {
    return this;
  };
}
class DefaultRepoHandler implements RepoHandler {
  name = "default";
  getTools(repoData: RepoData, env: any, ctx: any): Array<Tool> {
    // Generate a dynamic description based on the URL
    const fetchToolName = generateFetchToolName(repoData);
    const fetchToolDescription = generateFetchToolDescription(repoData);
    const searchToolName = generateSearchToolName(repoData);
    const searchToolDescription = generateSearchToolDescription(repoData);
    const codeSearchToolName = generateCodeSearchToolName(repoData);
    const codeSearchToolDescription =
      generateCodeSearchToolDescription(repoData);

    return [
      {
        name: fetchToolName,
        description: fetchToolDescription,
        paramsSchema: undefined,
        cb: async () => {
          return fetchDocumentation({ repoData, env, ctx });
        },
      },
      {
        name: searchToolName,
        description: searchToolDescription,
        paramsSchema: {
          query: z
            .string()
            .describe("The search query to find relevant documentation"),
        },
        cb: async ({ query }) => {
          return searchRepositoryDocumentation({
            repoData,
            query,
            env,
            ctx,
          });
        },
      },
      {
        name: codeSearchToolName,
        description: codeSearchToolDescription,
        paramsSchema: {
          query: z
            .string()
            .describe("The search query to find relevant code files"),
          page: z
            .number()
            .optional()
            .describe(
              "Page number to retrieve (starting from 1). Each page contains 30 results.",
            ),
        },
        cb: async ({ query, page }) => {
          return searchRepositoryCode({
            repoData,
            query,
            page,
            env,
            ctx,
          });
        },
      },
      {
        name: "fetchFunctionPaths",
        description:
          "Fetch up to 10 functions (name + file path) proximate to a given node",
        paramsSchema: {
          graphName: z.string().describe("Name of the graph to query"),
          functionName: z.string().describe("Name of the node to inspect"),
          limit: z.number().optional().default(10),
        },
        cb: async ({ graphName, functionName, limit = 10 }) => {
          const client = await FalkorDB.connect({
            socket: {
              host: "localhost",
              port: 6379,
              noDelay: false,
              keepAlive: false,
            },
          });
          try {
            const graph = client.selectGraph(graphName);
            const result = await fetchNode({
              repoData,
              ctx: { graph },
              env,
              nodeName: functionName,
              functionLimit: limit,
            });

            const items = result.connectedPaths;
            if (!items.length) {
              return {
                content: [
                  {
                    type: "text",
                    text: `No connected functions found for "${functionName}".`,
                  },
                ],
              };
            }

            const text =
              `Connected functions to "${functionName}" (max ${limit}):\n` +
              items.map((c, i) => `${i + 1}. ${c.name} — ${c.path}`).join("\n");

            return { content: [{ type: "text", text }] };
          } finally {
            await client.close();
          }
        },
      },
    ];
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

let defaultRepoHandler: DefaultRepoHandler;
export function getDefaultRepoHandler(): DefaultRepoHandler {
  if (!defaultRepoHandler) {
    defaultRepoHandler = new DefaultRepoHandler();
  }
  return defaultRepoHandler;
}
