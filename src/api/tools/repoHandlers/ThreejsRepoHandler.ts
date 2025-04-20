import type { RepoHandler, Tool } from "./RepoHandler.js";
import type { RepoData } from "../../../shared/repoData.js";
import { z } from "zod";
import {
  getReferenceDocsContent,
  getReferenceDocsListAsMarkdown,
  fetchThreeJsUrlsAsMarkdown,
} from "./threejs/utils.js";
import { searchRepositoryDocumentation } from "../commonTools.js";

const GET_REFERENCE_DOCS_LIST_TOOL_NAME = "get_threejs_reference_docs_list";
const GET_SPECIFIC_DOCS_CONTENT_TOOL_NAME = "get_threejs_specific_docs_content";

class ThreejsRepoHandler implements RepoHandler {
  name = "threejs";
  getTools(repoData: RepoData, env: any, ctx: any): Array<Tool> {
    const { owner, repo } = repoData;

    return [
      {
        name: GET_REFERENCE_DOCS_LIST_TOOL_NAME,
        description:
          "Get the reference docs list. This should be the first step. It will return a list of all the reference docs and manuals and their corresponding urls.",
        paramsSchema: {},
        cb: async () => {
          return await getReferenceDocsListAsMarkdown({ env });
        },
      },
      {
        name: GET_SPECIFIC_DOCS_CONTENT_TOOL_NAME,
        description:
          "Get the content of specific docs or manuals. This should be the second step. It will return the content of the specific docs or manuals. You can pass in a list of document or manual names.",
        paramsSchema: {
          documents: z
            .array(
              z.object({
                documentName: z
                  .string()
                  .describe("The document or manual name"),
              }),
            )
            .describe("The documents or manuals names to get the content of"),
        },
        cb: async (args) => {
          return await getReferenceDocsContent({
            env,
            documents: args.documents,
          });
        },
      },
      {
        name: "search_threejs_documentation",
        description:
          "Semantically search the repository documentation for the given query. Use this if you need to find information you don't have in the reference docs.",
        paramsSchema: {
          query: z
            .string()
            .describe("The query to search the repository documentation for"),
        },
        cb: async ({ query }) => {
          return await searchRepositoryDocumentation({
            repoData,
            query,
            env,
            ctx,
            fallbackSearch: noopFallbackSearch,
          });
        },
      },
      {
        name: "fetch_threejs_urls_inside_docs",
        description:
          "Fetch content from URLs that are inside the reference docs. Usually contains '#' in the url. Returns the content of the pages as markdown.",
        paramsSchema: {
          urls: z
            .array(
              z.object({
                url: z.string().describe("The URL of the page to fetch"),
                documentName: z
                  .string()
                  .describe("The document or manual name, if known")
                  .optional(),
              }),
            )
            .describe("The URLs of the pages to fetch"),
        },
        cb: async ({ urls }) => {
          return await fetchThreeJsUrlsAsMarkdown(urls);
        },
      },
    ];
  }

  async fetchDocumentation({
    repoData,
    env,
  }: {
    repoData: RepoData;
    env: Env;
    ctx: any;
  }): Promise<{
    fileUsed: string;
    content: { type: "text"; text: string }[];
  }> {
    const result = await getReferenceDocsListAsMarkdown({ env });
    return {
      fileUsed: result.filesUsed[0],
      content: result.content,
    };
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
    console.debug("Searching repository documentation for threejs");
    return await searchRepositoryDocumentation({
      repoData,
      query,
      env,
      ctx,
      fallbackSearch: noopFallbackSearch,
    });
  }
}

let threejsRepoHandler: ThreejsRepoHandler;
export function getThreejsRepoHandler(): ThreejsRepoHandler {
  if (!threejsRepoHandler) {
    threejsRepoHandler = new ThreejsRepoHandler();
  }
  return threejsRepoHandler;
}

async function noopFallbackSearch({
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
  return {
    searchQuery: query,
    content: [
      {
        type: "text",
        text: `Please use the ${GET_REFERENCE_DOCS_LIST_TOOL_NAME} tool first to get the list of reference docs and manuals, and then use the ${GET_SPECIFIC_DOCS_CONTENT_TOOL_NAME} tool to get the content of the specific docs or manuals.`,
      },
    ],
  };
}
