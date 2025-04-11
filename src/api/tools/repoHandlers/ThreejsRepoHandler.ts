import type { RepoHandler, Tool } from "./RepoHandler.js";
import type { RepoData } from "../../../shared/repoData.js";
import htmlToMd from "html-to-md";
import { getUrlContentWithCache } from "../commonTools.js";
import { z } from "zod";
class ThreejsRepoHandler implements RepoHandler {
  name = "threejs";
  getTools(repoData: RepoData, env?: any): Array<Tool> {
    return [
      {
        name: "get_reference_docs_list",
        description:
          "Get the reference docs list. This should be the first step. It will return a list of all the reference docs and manuals and their corresponding urls.",
        paramsSchema: {},
        cb: async () => {
          return await getReferenceDocsListAsMarkdown({ env });
        },
      },
      {
        name: "get_specific_docs_content",
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
        name: "fetch_urls_inside_docs",
        description:
          "Fetch content from URLs. Return the content of the pages as markdown.",
        paramsSchema: {
          urls: z.array(z.string()).describe("The URLs of the pages to fetch"),
        },
        cb: async ({ urls }) => {
          return await fetchThreeJsUrlsAsMarkdown(urls, env);
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

const THREEJS_BASE_URL = "https://threejs.org";
const THREEJS_DOCS_BASE_URL = `${THREEJS_BASE_URL}/docs`;
const THREEJS_MANUAL_BASE_URL = `${THREEJS_BASE_URL}/manual`;
const THREEJS_DOCS_REF_URL = `${THREEJS_DOCS_BASE_URL}/list.json`;
const THREEJS_MANUAL_REF_URL = `${THREEJS_MANUAL_BASE_URL}/list.json`;

async function getByKey(
  key: string,
  env: any,
): Promise<{ type: "doc" | "manual"; url: string }> {
  const { docsCacheByInnerKey, manualCacheByInnerKey } =
    await getListFlatCache(env);
  if (docsCacheByInnerKey[key]) {
    return { type: "doc", url: docsCacheByInnerKey[key] };
  }
  if (manualCacheByInnerKey[key]) {
    return { type: "manual", url: manualCacheByInnerKey[key] };
  }
  const docAsValue = Object.entries(docsCacheByInnerKey).find(
    ([_, url]) => url === key,
  );
  if (docAsValue) {
    return { type: "doc", url: key };
  }
  const manualAsValue = Object.entries(manualCacheByInnerKey).find(
    ([_, url]) => url === key,
  );
  if (manualAsValue) {
    return { type: "manual", url: key };
  }
  throw new Error(`No url found for key ${key}`);
}

let docsCacheByInnerKey: Record<string, string> | null = null;
let manualCacheByInnerKey: Record<string, string> | null = null;
async function getListFlatCache(env: any) {
  // build the cache if it's not built
  if (!docsCacheByInnerKey || !manualCacheByInnerKey) {
    const { docs, manual } = await getReferenceDocsList({ env });
    docsCacheByInnerKey = {};
    manualCacheByInnerKey = {};
    Object.entries(docs).forEach(([_, part]) => {
      Object.entries(part).forEach(([_, section]) => {
        Object.entries(section).forEach(([documentName, url]) => {
          if (docsCacheByInnerKey) {
            docsCacheByInnerKey[documentName] = url;
          }
        });
      });
    });
    Object.entries(manual).forEach(([_, section]) => {
      Object.entries(section).forEach(([documentName, url]) => {
        if (manualCacheByInnerKey) {
          manualCacheByInnerKey[documentName] = url;
        }
      });
    });
  }
  return { docsCacheByInnerKey, manualCacheByInnerKey };
}

async function getReferenceDocsList({ env }: { env: any }): Promise<{
  docs: Record<string, Record<string, Record<string, string>>>;
  manual: Record<string, Record<string, string>>;
}> {
  const [docs, manual] = await Promise.all([
    (await getUrlContentWithCache({
      url: THREEJS_DOCS_REF_URL,
      env,
      format: "json",
    })) as {
      en: Record<string, Record<string, Record<string, string>>>;
    },
    (await getUrlContentWithCache({
      url: THREEJS_MANUAL_REF_URL,
      env,
      format: "json",
    })) as {
      en: Record<string, Record<string, string>>;
    },
  ]);
  return { docs: docs.en, manual: manual.en };
}

async function getReferenceDocsListAsMarkdown({ env }: { env: any }): Promise<{
  filesUsed: string[];
  content: { type: "text"; text: string }[];
}> {
  const { docs, manual } = await getReferenceDocsList({ env });

  const result = `
  # Three.js Documentation

  ## Reference Documentation
  ${Object.entries(docs)
    .map(
      ([partName, part]) => `
    ### ${partName}
    ${Object.entries(part)
      .map(
        ([sectionName, section]) => `
      - ${sectionName}
      ${Object.entries(section)
        .map(
          ([documentName, url]) => `
        - ${documentName}: ${url}
        `,
        )
        .join("\n")}
      `,
      )
      .join("\n")}
    `,
    )
    .join("\n")}

  ## Manual Documentation
  ${Object.entries(manual)
    .map(
      ([key, value]) => `
    ### ${key}
    ${Object.entries(value)
      .map(
        ([key, value]) => `
      ${key}: ${value}
      `,
      )
      .join("\n")}
    `,
    )
    .join("\n")}
  `;

  return {
    filesUsed: [THREEJS_DOCS_REF_URL, THREEJS_MANUAL_REF_URL],
    content: [
      {
        type: "text" as const,
        text: result,
      },
    ],
  };
}

async function getReferenceDocsContent({
  env,
  documents,
}: {
  env: any;
  documents: { documentName: string }[];
}): Promise<{
  filesUsed: string[];
  content: { type: "text"; text: string }[];
}> {
  // get the urls to fetch
  const urlsToFetch = await Promise.all(
    documents.map(async ({ documentName }) => {
      const { type, url } = await getByKey(documentName, env);
      if (type === "doc") {
        return {
          documentName,
          url: `/docs/${url}.html`,
        };
      }
      return {
        documentName,
        url: `/manual/${url}.html`,
      };
    }),
  );

  const content = await fetchThreeJsUrlsAsMarkdown(urlsToFetch, env);

  return {
    filesUsed: urlsToFetch.map(({ url }) => url),
    content: [
      {
        type: "text" as const,
        text: content,
      },
    ],
  };
}

async function fetchThreeJsUrlsAsMarkdown(
  urlsToFetch: { documentName?: string; url: string }[],
  env: any,
) {
  // get the html content of each page
  const htmlContent = await Promise.all(
    urlsToFetch.map(async ({ documentName, url }) => {
      let urlToFetch: URL;
      if (url.startsWith("http")) {
        urlToFetch = new URL(url);
      } else {
        const urlObject = new URL(url, THREEJS_BASE_URL);
        const urlObjectPath = urlObject.pathname;
        // remove hashes
        const cleanUrl = urlObjectPath.replace(/#/g, "");
        urlToFetch = new URL(cleanUrl, THREEJS_BASE_URL);
      }
      let documentNameToUse = documentName;
      if (!documentNameToUse) {
        try {
          documentNameToUse = urlToFetch.pathname
            .split("/")
            .pop()
            ?.replace(".html", "");
        } catch (e) {
          console.error(`Error getting document name from url ${url}`, e);
        }
      }
      const text = await getUrlContentWithCache({
        url: urlToFetch.toString(),
        env,
        format: "text",
      });
      return {
        documentName: documentName ?? urlToFetch.pathname,
        text: text.replace(
          new RegExp(`\\[name\\]`, "g"),
          documentNameToUse ?? "[name]",
        ),
      };
    }),
  );

  // convert the html to markdown and concatenate the content use htmltomd
  const content = htmlContent.reduce((acc, { documentName, text }) => {
    return `
      ${acc}
      # ${documentName}
      ${htmlToMd(text)}
      `;
  }, "");

  return content;
}
