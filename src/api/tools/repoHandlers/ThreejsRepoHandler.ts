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
  searchRepositoryDocumentation,
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
        name: "get_threejs_files_inside_docs",
        description:
          "Get the content of specific docs or manuals by path or name. This should be the second step after fetching the reference docs list to deep dive into the content of the specific docs or manuals.",
        paramsSchema: {
          documents: z
            .array(
              z.object({
                documentName: z.string().describe("The document path or name"),
              }),
            )
            .describe("The names or paths of the documents to fetch"),
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
          });
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
