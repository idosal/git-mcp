import htmlToMd from "html-to-md";
import { fetchUrlContent } from "../../../utils/cache.js";
const THREEJS_BASE_URL = "https://threejs.org";
const THREEJS_DOCS_BASE_URL = `${THREEJS_BASE_URL}/docs`;
const THREEJS_MANUAL_BASE_URL = `${THREEJS_BASE_URL}/manual`;
const THREEJS_DOCS_REF_URL = `${THREEJS_DOCS_BASE_URL}/list.json`;
const THREEJS_MANUAL_REF_URL = `${THREEJS_MANUAL_BASE_URL}/list.json`;

/**
 * Get the url of a document by key, flattens the docs and manual lists
 */
async function getByKey(
  key: string,
  env: Env,
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
/**
 * Flatten the docs and manual lists
 */
async function getListFlatCache(env: Env) {
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

/**
 * Fetches https://threejs.org/docs/list.json and https://threejs.org/manual/list.json
 */
async function getReferenceDocsList({ env }: { env: Env }): Promise<{
  docs: Record<string, Record<string, Record<string, string>>>;
  manual: Record<string, Record<string, string>>;
}> {
  const [docs, manual] = await Promise.all([
    (await fetchUrlContent({
      url: THREEJS_DOCS_REF_URL,
      format: "json",
    })) as {
      en: Record<string, Record<string, Record<string, string>>>;
    } | null,
    (await fetchUrlContent({
      url: THREEJS_MANUAL_REF_URL,
      format: "json",
    })) as {
      en: Record<string, Record<string, string>>;
    } | null,
  ]);
  if (!docs || !manual) {
    console.error("Error fetching docs or manual");
  }
  return { docs: docs?.en ?? {}, manual: manual?.en ?? {} };
}

/**
 * Get the docs and manual lists as markdown
 */
export async function getReferenceDocsListAsMarkdown({
  env,
}: {
  env: Env;
}): Promise<{
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

/**
 * Get the content of specific documents
 */
export async function getReferenceDocsContent({
  env,
  documents,
}: {
  env: Env;
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

  return await fetchThreeJsUrlsAsMarkdown(urlsToFetch);
}

/**
 * A specific tool for fetching links inside threejs documentation, since the urls are not standard
 */
export async function fetchThreeJsUrlsAsMarkdown(
  urlsToFetch: { documentName?: string; url: string }[],
): Promise<{
  filesUsed: string[];
  content: { type: "text"; text: string }[];
}> {
  // get the html content of each page
  const htmlContent = await Promise.all(
    urlsToFetch.map(async ({ documentName, url }) => {
      let urlToFetch: URL;
      if (url.startsWith("http")) {
        urlToFetch = new URL(url);
      } else if (
        url.endsWith(".html") &&
        !url.includes("api") &&
        !url.includes("manual") &&
        !url.includes("docs") &&
        !url.includes("examples")
      ) {
        urlToFetch = new URL(`/manual/en/${url}`, THREEJS_BASE_URL);
      } else {
        const urlObject = new URL(url, THREEJS_BASE_URL);
        const urlObjectPath = urlObject.pathname;
        // remove hashes
        const cleanUrl = urlObjectPath.replace(/#/g, "");
        urlToFetch = new URL(cleanUrl, THREEJS_BASE_URL);
        if (
          !urlToFetch.toString().includes(`${THREEJS_BASE_URL}/docs`) &&
          !urlToFetch.toString().includes(`${THREEJS_BASE_URL}/manual`)
        ) {
          urlToFetch = new URL(
            urlToFetch
              .toString()
              .replace(THREEJS_BASE_URL, `${THREEJS_BASE_URL}/docs`),
          );
        }
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
      const text = await fetchUrlContent({
        url: urlToFetch.toString(),
        format: "text",
      });

      if (!text) {
        console.error(`Error fetching url ${urlToFetch}`);
        return {
          documentName: documentName ?? urlToFetch.pathname,
          text: "",
        };
      }

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
