import type { RepoData } from "../../../shared/repoData.js";
import type { RepoHandler, Tool } from "./RepoHandler.js";
import { z } from "zod";
import {
  fetchDocumentation,
  searchRepositoryDocumentation,
  searchRepositoryCode,
} from "../commonTools.js";
import { incrementRepoViewCount } from "../../utils/badge.js";
import rawMapping from "./generic/static-mapping.json";

const badgeCountAllowedRepos = ["mcp-ui", "git-mcp"];

class GenericRepoHandler implements RepoHandler {
  name = "generic";
  getTools(_: RepoData, env: any, ctx: any): Array<Tool> {
    console.debug("Creating tools for docs page");

    return [
      {
        name: "match_common_libs_owner_repo_mapping",
        description:
          "Match a library name to an owner/repo. Don't use it if you have an owner and repo already. Use this first if only a library name was provided. If found - you can use owner and repo to call other tools. If not found - try to use the library name directly in other tools.",
        paramsSchema: {
          library: z
            .string()
            .describe(
              "The name of the library to try and match to an owner/repo.",
            ),
        },
        cb: async ({ library }: { library: string }) => {
          if (!library) {
            return {
              content: [
                {
                  type: "text",
                  text: "No library name provided",
                },
              ],
            };
          }
          const nameMapping = mappingCaseInsensitive;
          const repoMapping = mappingByRepoCaseInsensitive;

          const repo =
            nameMapping[library?.toLowerCase()] ??
            repoMapping[library?.toLowerCase()];
          if (!repo) {
            return {
              content: [
                {
                  type: "text",
                  text: `No owner/repo found for ${library}`,
                },
              ],
            };
          }

          if (badgeCountAllowedRepos.includes(repo.repo)) {
            ctx.waitUntil(
              incrementRepoViewCount(
                env as CloudflareEnvironment,
                repo.owner,
                repo.repo,
              ).catch((err) => {
                console.error("Error incrementing repo view count:", err);
              }),
            );
          }

          return {
            content: [
              {
                type: "text",
                text: JSON.stringify({
                  library,
                  libraryTitle: repo.title,
                  owner: repo.owner,
                  repo: repo.repo,
                }),
              },
            ],
          };
        },
      },
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
          return fetchDocumentation({ repoData, env, ctx });
        },
      },
      {
        name: "search_generic_documentation",
        description:
          "Semantically search in documentation for any GitHub repository by providing owner, project name, and search query. Useful for specific queries.",
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
          return searchRepositoryDocumentation({ repoData, query, env, ctx });
        },
      },
      {
        name: "search_generic_code",
        description:
          "Search for code in any GitHub repository by providing owner, project name, and search query. Returns matching files. Supports pagination with 30 results per page.",
        paramsSchema: {
          owner: z
            .string()
            .describe("The GitHub repository owner (username or organization)"),
          repo: z.string().describe("The GitHub repository name"),
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
        cb: async ({ owner, repo, query, page }) => {
          const repoData: RepoData = {
            owner,
            repo,
            urlType: "github",
            host: "gitmcp.io",
          };
          return searchRepositoryCode({ repoData, query, page, env, ctx });
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
    env: CloudflareEnvironment;
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
    env: CloudflareEnvironment;
    ctx: any;
  }): Promise<{
    searchQuery: string;
    content: { type: "text"; text: string }[];
  }> {
    return await searchRepositoryDocumentation({ repoData, query, env, ctx });
  }
}

let genericRepoHandler: GenericRepoHandler;
export function getGenericRepoHandler(): GenericRepoHandler {
  if (!genericRepoHandler) {
    genericRepoHandler = new GenericRepoHandler();
  }
  return genericRepoHandler;
}

async function fetchRepoMapping(): Promise<
  Record<string, (typeof mapping)[string]>
> {
  return mappingCaseInsensitive;
}

async function fetchRepoMappingByRepoName(): Promise<
  Record<string, (typeof mapping)[string]>
> {
  return mappingByRepoCaseInsensitive;
}

const mapping = rawMapping as unknown as {
  [key: string]: {
    title: string;
    repoName: `${string}/${string}`;
    githubUrl: string;
    description: string;
    owner: string;
    repo: string;
  };
};
const mappingCaseInsensitive = Object.fromEntries(
  Object.entries(mapping).map(([key, value]) => [key.toLowerCase(), value]),
) as Record<string, (typeof mapping)[string]>;

const mappingByRepoCaseInsensitive = Object.fromEntries(
  Object.entries(mapping).map(([, value]) => [value.repo.toLowerCase(), value]),
) as Record<string, (typeof mapping)[string]>;
