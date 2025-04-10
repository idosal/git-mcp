import type { RepoData } from "../../../shared/repoData.js";
import type { RepoHandler, Tool } from "./RepoHandler.js";
import { z } from "zod";
import {
  fetchDocumentation,
  searchRepositoryDocumentation,
  searchRepositoryCode,
} from "../commonTools.js";
import { fetchFileWithRobotsTxtCheck } from "../../utils/robotsTxt.js";
import htmlToMd from "html-to-md";

class GenericRepoHandler implements RepoHandler {
  name = "generic";
  getTools(_: RepoData, env?: any): Array<Tool> {
    console.debug("Creating tools for docs page");

    return [
      {
        name: "fetch_generic_documentation",
        description:
          "Fetch documentation for any GitHub repository by providing owner and project name",
        paramsSchema: {
          owner: z
            .string()
            .describe("The GitHub repository owner (username or organization)"),
          repo: z.string().describe("The GitHub repository name"),
        },
        cb: async ({ owner, repo }) => {
          const repoData: RepoData = {
            owner,
            repo,
            urlType: "github",
            host: "gitmcp.io",
          };
          return fetchDocumentation({ repoData, env });
        },
      },
      {
        name: "search_generic_documentation",
        description:
          "Semantically search in documentation for any GitHub repository by providing owner, project name, and search query. Useful for specific queries. Don't call if you already used fetch_generic_documentation on this owner and project name.",
        paramsSchema: {
          owner: z
            .string()
            .describe("The GitHub repository owner (username or organization)"),
          repo: z.string().describe("The GitHub repository name"),
          query: z
            .string()
            .describe("The search query to find relevant documentation"),
        },
        cb: async ({ owner, repo, query }) => {
          const repoData: RepoData = {
            owner,
            repo,
            urlType: "github",
            host: "gitmcp.io",
          };
          return searchRepositoryDocumentation({ repoData, query, env });
        },
      },
      {
        name: "search_generic_code",
        description:
          "Search for code in any GitHub repository by providing owner, project name, and search query. Returns matching files and code snippets.",
        paramsSchema: {
          owner: z
            .string()
            .describe("The GitHub repository owner (username or organization)"),
          repo: z.string().describe("The GitHub repository name"),
          query: z
            .string()
            .describe(
              "The search query to find relevant code files and snippets",
            ),
        },
        cb: async ({ owner, repo, query }) => {
          const repoData: RepoData = {
            owner,
            repo,
            urlType: "github",
            host: "gitmcp.io",
          };
          return searchRepositoryCode({ repoData, query, env });
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
          try {
            // Use the robotsTxt checking function to respect robots.txt rules
            const result = await fetchFileWithRobotsTxtCheck(url, env);

            if (result.blockedByRobots) {
              return {
                url,
                status: "blocked",
                content: [
                  {
                    type: "text" as const,
                    text: `Access to ${url} is disallowed by robots.txt. GitMCP respects robots.txt directives.`,
                  },
                ],
              };
            }

            if (!result.content) {
              return {
                url,
                status: "not_found",
                content: [
                  {
                    type: "text" as const,
                    text: `Content at ${url} could not be retrieved. The resource may not exist or may require authentication.`,
                  },
                ],
              };
            }

            let finalContent = result.content;

            // Convert HTML to markdown if content appears to be HTML
            if (
              finalContent.trim().startsWith("<!DOCTYPE") ||
              finalContent.trim().startsWith("<html") ||
              finalContent.includes("<body")
            ) {
              try {
                finalContent = htmlToMd(finalContent);
              } catch (error) {
                console.warn(
                  `Error converting HTML to Markdown for ${url}: ${error}`,
                );
                // Continue with the original content if conversion fails
              }
            }

            return {
              url,
              status: "success",
              content: [
                {
                  type: "text" as const,
                  text: finalContent,
                },
              ],
            };
          } catch (error) {
            console.error(`Error fetching ${url}: ${error}`);
            return {
              url,
              status: "error",
              content: [
                {
                  type: "text" as const,
                  text: `Error fetching content from ${url}: ${error}`,
                },
              ],
            };
          }
        },
      },
    ];
  }

  async fetchDocumentation({
    repoData,
    env,
  }: {
    repoData: RepoData;
    env?: any;
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
    env?: any;
  }): Promise<{
    searchQuery: string;
    content: { type: "text"; text: string }[];
  }> {
    return await searchRepositoryDocumentation({ repoData, query, env });
  }
}

let genericRepoHandler: GenericRepoHandler;
export function getGenericRepoHandler(): GenericRepoHandler {
  if (!genericRepoHandler) {
    genericRepoHandler = new GenericRepoHandler();
  }
  return genericRepoHandler;
}
