import type { RepoHandler, Tool } from "./RepoHandler.js";
import type { RepoData } from "../../../shared/repoData.js";
import { z } from "zod";
import {
  getReferenceDocsContent,
  getReferenceDocsListAsMarkdown,
  fetchThreeJsUrlsAsMarkdown,
} from "./threejs/utils.js";
import {
  fetchUrlContent,
  searchRepositoryDocumentationAutoRag,
} from "../commonTools.js";
class ThreejsRepoHandler implements RepoHandler {
  name = "threejs";
  getTools(repoData: RepoData, env: any, ctx: any): Array<Tool> {
    return [
      {
        name: "get_threejs_reference_docs_list",
        description:
          "Get the reference docs list. This should be the first step. It will return a list of all the reference docs and manuals and their corresponding urls.",
        paramsSchema: {},
        cb: async () => {
          return await getReferenceDocsListAsMarkdown({ env });
        },
      },
      {
        name: "get_threejs_specific_docs_content",
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
        name: "fetch_threejs_urls_inside_docs",
        description:
          "Fetch content from URLs. Return the content of the pages as markdown.",
        paramsSchema: {
          urls: z.array(z.string()).describe("The URLs of the pages to fetch"),
        },
        cb: async ({ urls }) => {
          return await fetchThreeJsUrlsAsMarkdown(urls);
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
      // {
      //   name: "search_repository_documentation",
      //   description:
      //     "Semantically search the repository documentation for the given query. Use this if you need to find information you don't have in the reference docs.",
      //   paramsSchema: {
      //     query: z
      //       .string()
      //       .describe("The query to search the repository documentation for"),
      //   },
      //   cb: async ({ query }) => {
      //     return await searchRepositoryDocumentationAutoRag({
      //       repoData,
      //       query,
      //       env,
      //       ctx,
      //       autoragPipeline: "llms-txt-threejs-rag",
      //     });
      //   },
      // },
    ];
  }

  async fetchDocumentation({
    repoData,
    env,
  }: {
    repoData: RepoData;
    env: any;
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
  }: {
    repoData: RepoData;
    query: string;
    env: any;
  }): Promise<{
    searchQuery: string;
    content: { type: "text"; text: string }[];
  }> {
    console.debug("Searching repository documentation for threejs");
    const result = await getReferenceDocsContent({
      env,
      documents: [{ documentName: query }],
    });
    return {
      searchQuery: query,
      content: result.content,
    };
  }
}

let threejsRepoHandler: ThreejsRepoHandler;
export function getThreejsRepoHandler(): ThreejsRepoHandler {
  if (!threejsRepoHandler) {
    threejsRepoHandler = new ThreejsRepoHandler();
  }
  return threejsRepoHandler;
}
