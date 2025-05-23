import {
  fetchDocumentation,
  searchRepositoryDocumentation,
  searchRepositoryCode,
  searchRepositoryIssues,
  fetchUrlContent,
  generateFetchToolName,
  generateFetchToolDescription,
  generateSearchToolName,
  generateSearchToolDescription,
  generateCodeSearchToolName,
  generateCodeSearchToolDescription,
  generateIssueSearchToolName,
  generateIssueSearchToolDescription,
} from "../commonTools.js";
import { z } from "zod";
import type { RepoData } from "../../../shared/repoData.js";
import type { RepoHandler, Tool } from "./RepoHandler.js";

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
    const issueSearchToolName = generateIssueSearchToolName(repoData);
    const issueSearchToolDescription =
      generateIssueSearchToolDescription(repoData);

    return [
      {
        name: fetchToolName,
        description: fetchToolDescription,
        paramsSchema: z.union([z.object({}), z.null()]),
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
        name: issueSearchToolName,
        description: issueSearchToolDescription,
        paramsSchema: {
          query: z
            .string()
            .describe("The search query to find relevant issues"),
          state: z
            .enum(["open", "closed", "all"])
            .optional()
            .describe(
              "Filter issues by state. Defaults to all if not specified.",
            ),
          page: z
            .number()
            .optional()
            .describe(
              "Page number to retrieve (starting from 1). Each page contains 30 results.",
            ),
        },
        cb: async ({ query, state, page }) => {
          return searchRepositoryIssues({
            repoData,
            query,
            state,
            page,
            env,
            ctx,
          });
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
