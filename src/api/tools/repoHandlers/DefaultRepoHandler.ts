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
import { getFunctionInfo } from "./graphTools.js";
import { FalkorDB } from "falkordb";

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
      //Search for code within the GitHub repository: "${owner}/${repo}" using the GitHub Search API (exact match). Returns matching files for you to query further if relevant.
      // Extract code examples that uses ${functionName} function, use it whenever you need to find code examples. Returns code snippets that use this function.
      {
        name: "fetchFunctionCallers",
        description:
          "Extract code examples that uses given function, use it whenever you need to find code examples. Returns code snippets that use this function.",
        paramsSchema: {
          graphName: z.string().describe("Name of the graph to query'"),
          functionName: z
            .string()
            .describe("Name of the function to find who calls it"),
          limit: z
            .number()
            .optional()
            .default(10)
            .describe("Max number of calling functions to return"),
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
            const result = await getFunctionInfo({
              repoData,
              ctx: { graph },
              env,
              nodeName: functionName,
              functionLimit: limit,
            });

            let callers = result.connectedFunctions;

            if (!callers.length) {
              return {
                content: [
                  {
                    type: "text",
                    text: `No calling functions found for "${functionName}".`,
                  },
                ],
              };
            }

            const summary = callers
              .map(
                (c, i) =>
                  `${i + 1}. ${c.name} — ${c.path}\n\`\`\`js\n${c.code}\n\`\`\``,
              )
              .join("\n\n");

            return {
              content: [
                {
                  type: "text",
                  text: [
                    `I found ${callers.length} function(s) that call "${functionName}":`,
                    "",
                    summary,
                  ].join("\n"),
                },
              ],
              raw: { callers },
            };
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
