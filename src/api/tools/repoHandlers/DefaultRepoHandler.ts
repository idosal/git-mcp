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

class DefaultRepoHandler implements RepoHandler {
  name = "default";
  getTools(repoData: RepoData, env: any): Array<Tool> {
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
          return fetchDocumentation({ repoData, env });
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
          });
        },
      },
      {
        name: "fetch_url_content",
        description:
          "Fetch content from a URL. Use this to retrieve referenced documents or pages that were mentioned in previously fetched documentation.",
        paramsSchema: {
          url: z.string().describe("The URL of the document or page to fetch"),
        },
        cb: async ({ url }) => {
          return fetchUrlContent({ url, env });
        },
      },
    ];
  }

  async fetchDocumentation({
    repoData,
    env,
  }: {
    repoData: RepoData;
    env: any;
  }): Promise<{
    fileUsed: string;
    content: { type: "text"; text: string }[];
  }> {
    return await fetchDocumentation({ repoData, env });
  }

  async searchRepositoryDocumentation({
    repoData,
    query,
    env,
  }: {
    repoData: RepoData;
    query: string;
    env: any;
  }): Promise<{
    searchQuery: string;
    content: { type: "text"; text: string }[];
  }> {
    return await searchRepositoryDocumentation({
      repoData,
      query,
      env,
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
