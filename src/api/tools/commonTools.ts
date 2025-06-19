import type { RepoData } from "../../shared/repoData.js";
import {
  constructGithubUrl,
  fetchFileFromGitHub,
  getRepoBranch,
  searchGitHubRepo,
} from "../utils/github.js";
import { fetchFileWithRobotsTxtCheck } from "../utils/robotsTxt.js";
import htmlToMd from "html-to-md";
import { searchCode } from "../utils/githubClient.js";
import { fetchFileFromR2 } from "../utils/r2.js";
import { generateServerName } from "../../shared/nameUtils.js";
import {
  getCachedFetchDocResult,
  cacheFetchDocResult,
} from "../utils/cache.js";

// Define the return type for fetchDocumentation
export type FetchDocumentationResult = {
  fileUsed: string;
  content: { type: "text"; text: string }[];
};

// Add env parameter to access Cloudflare's bindings
export async function fetchDocumentation({
  repoData,
  env,
  ctx,
}: {
  repoData: RepoData;
  env: CloudflareEnvironment;
  ctx: any;
}): Promise<FetchDocumentationResult> {
  const { owner, repo, urlType } = repoData;
  const cacheTTL = 30 * 60; // 30 minutes in seconds

  // Try fetching from cache first
  if (owner && repo) {
    const cachedResult = await getCachedFetchDocResult(owner, repo, env);
    if (cachedResult) {
      console.log(
        `Returning cached fetchDocumentation result for ${owner}/${repo}`,
      );
      return cachedResult;
    }
  }

  // Initialize fileUsed to prevent "used before assigned" error
  let fileUsed = "unknown";
  let content: string | null = null;
  let docsPath: string = "";
  let docsBranch: string = "";
  let blockedByRobots = false;

  // Check for subdomain pattern: {subdomain}.gitmcp.io/{path}
  if (urlType === "subdomain") {
    // Map to github.io
    const githubIoDomain = `${owner}.github.io`;
    const pathWithSlash = repo ? `/${repo}` : "";
    const baseURL = `https://${githubIoDomain}${pathWithSlash}/`;

    // Try to fetch llms.txt with robots.txt check
    const llmsResult = await fetchFileWithRobotsTxtCheck(
      baseURL + "llms.txt",
      env,
    );

    if (llmsResult.blockedByRobots) {
      blockedByRobots = true;
      console.log(`Access to ${baseURL}llms.txt disallowed by robots.txt`);
    } else if (llmsResult.content) {
      content = llmsResult.content;
      fileUsed = "llms.txt";
    } else {
      // If llms.txt is not found or disallowed, fall back to the landing page
      console.warn(
        `llms.txt not found or not allowed at ${baseURL}, trying base URL`,
      );
      const indexResult = await fetchFileWithRobotsTxtCheck(baseURL, env);

      if (indexResult.blockedByRobots) {
        blockedByRobots = true;
        console.log(`Access to ${baseURL} disallowed by robots.txt`);
      } else if (indexResult.content) {
        try {
          // Convert HTML to Markdown for proper processing
          content = htmlToMd(indexResult.content);
          fileUsed = "landing page (index.html, converted to Markdown)";
        } catch (error) {
          console.warn(
            `Error converting HTML to Markdown for ${baseURL}: ${error}`,
          );
        }
      }

      // If index page was blocked or not available, try readme.md
      if (!content && !blockedByRobots) {
        const readmeResult = await fetchFileWithRobotsTxtCheck(
          baseURL + "README.md",
          env,
        );

        if (readmeResult.blockedByRobots) {
          blockedByRobots = true;
          console.log(`Access to ${baseURL}README.md disallowed by robots.txt`);
        } else if (readmeResult.content) {
          content = readmeResult.content;
          fileUsed = "README.md";
        }
      }
    }

    // If any path was blocked by robots.txt, return appropriate message
    if (blockedByRobots) {
      content =
        "Access to this GitHub Pages site is restricted by robots.txt. GitMCP respects robots.txt directives.";
      fileUsed = "robots.txt restriction";
    }
  } else if (urlType === "github" && owner && repo) {
    // Try static paths + search for llms.txt directly
    docsBranch = await getRepoBranch(owner, repo, env); // Get branch once

    console.log(`Checking static paths for llms.txt in ${owner}/${repo}`);
    const possibleLocations = [
      "docs/docs/llms.txt", // Current default
      "llms.txt", // Root directory
      "docs/llms.txt", // Common docs folder
    ];

    // Create array of all location+branch combinations to try
    const fetchPromises = possibleLocations.flatMap((location) => [
      {
        promise: fetchFileFromGitHub(
          owner,
          repo,
          docsBranch,
          location,
          env,
          false,
        ),
        location,
        branch: docsBranch,
      },
    ]);

    // Execute all fetch promises in parallel
    const results = await Promise.all(
      fetchPromises.map(async ({ promise, location, branch }) => {
        const content = await promise;
        return { content, location, branch };
      }),
    );

    for (const location of possibleLocations) {
      const mainResult = results.find(
        (r) => r.location === location && r.content !== null,
      );
      if (mainResult) {
        content = mainResult.content;
        fileUsed = `llms.txt`;

        docsPath = constructGithubUrl(
          owner,
          repo,
          mainResult.branch,
          mainResult.location,
        );
        break;
      }
    }

    // Fallback to GitHub Search API if static paths don't work for llms.txt
    if (!content) {
      console.log(
        `llms.txt not found in static paths, trying GitHub Search API`,
      );

      const result = await searchGitHubRepo(
        owner,
        repo,
        "llms.txt",
        docsBranch,
        env,
        ctx,
      );
      if (result) {
        content = result.content;
        docsPath = result.path;
        fileUsed = "llms.txt";
      }
    }

    // Try R2 fallback if llms.txt wasn't found via GitHub
    if (!content) {
      // Try to fetch pre-generated llms.txt
      content = (await fetchFileFromR2(owner, repo, "llms.txt", env)) ?? null;
      if (content) {
        console.log(`Fetched pre-generated llms.txt for ${owner}/${repo}`);
        fileUsed = "llms.txt (generated)";
      } else {
        console.error(`No pre-generated llms.txt found for ${owner}/${repo}`);
      }
    }

    // Fallback to README if llms.txt not found in any location (GitHub or R2)
    if (!content) {
      console.log(
        `llms.txt not found, trying README.* at root`,
        owner,
        repo,
        docsBranch,
      );
      // Ensure docsBranch is available (should be fetched above)
      if (!docsBranch) {
        docsBranch = await getRepoBranch(owner, repo, env);
      }

      // Search for README.* files in the root directory
      const readmeResult = await searchGitHubRepo(
        owner,
        repo,
        "README+path:/", // Search for files like README.* in root
        docsBranch, // Use the determined branch
        env,
        ctx,
      );

      if (readmeResult) {
        content = readmeResult.content;
        // Extract filename from the path for clarity, default to full path if extraction fails
        const filename =
          readmeResult.path.split("/").pop() || readmeResult.path;
        fileUsed = filename; // e.g., "README.md", "README.asciidoc"
        docsPath = constructGithubUrl(
          owner,
          repo,
          docsBranch,
          readmeResult.path,
        ); // Use the full path found
        console.log(`Found README file via search: ${fileUsed}`);
      } else {
        console.log(`No README file found at root for ${owner}/${repo}`);
      }
    }

    if (!content) {
      console.error(`Failed to find documentation for ${owner}/${repo}`);
    }
  }

  if (owner && repo) {
    ctx.waitUntil(
      enqueueDocumentationProcessing(
        owner,
        repo,
        content,
        fileUsed,
        docsPath,
        docsBranch,
        env,
      ),
    );
  }

  if (!content) {
    content = "No documentation found.";
    return {
      fileUsed,
      content: [
        {
          type: "text" as const,
          text: content,
        },
      ],
    };
  }

  const result: FetchDocumentationResult = {
    fileUsed,
    content: [
      {
        type: "text" as const,
        text: content,
      },
    ],
  };

  if (owner && repo) {
    ctx.waitUntil(
      cacheFetchDocResult(owner, repo, result, cacheTTL, env).catch((error) => {
        console.warn(`Failed to cache fetch documentation result: ${error}`);
      }),
    );
  }

  return result;
}

async function enqueueDocumentationProcessing(
  owner: string,
  repo: string,
  content: string | null,
  fileUsed: string,
  docsPath: string,
  docsBranch: string,
  env: Env,
) {
  try {
    if (env.MY_QUEUE) {
      console.log("Enqueuing documentation processing", owner, repo);
      const repoUrl = `https://github.com/${owner}/${repo}`;

      // Prepare and send message to queue
      const message = {
        owner,
        repo,
        repo_url: repoUrl,
        file_url: docsPath,
        content_length: content?.length,
        file_used: fileUsed,
        docs_branch: docsBranch,
      };

      await env.MY_QUEUE.send(JSON.stringify(message));
      console.log(
        `Queued documentation processing for ${owner}/${repo}`,
        message,
      );
    } else {
      console.error("Queue 'MY_QUEUE' not available in environment");
    }
  } catch (error) {
    console.error(
      `Failed to enqueue documentation request for ${owner}/${repo}`,
      error,
    );
  }
}

export async function searchRepositoryDocumentation({
  repoData,
  query,
  env,
  ctx,
  fallbackSearch = searchRepositoryDocumentationNaive,
}: {
  repoData: RepoData;
  query: string;
  env: CloudflareEnvironment;
  ctx: any;
  fallbackSearch?: typeof searchRepositoryDocumentationNaive;
}): Promise<{
  searchQuery: string;
  content: { type: "text"; text: string }[];
}> {
  if (!env.DOCS_BUCKET) {
    throw new Error("DOCS_BUCKET is not available in environment");
  }
  const docsInR2 = !!(await env.DOCS_BUCKET.head(
    `${repoData.owner}/${repoData.repo}/llms.txt`,
  ));
  if (docsInR2) {
    try {
      const autoragResult = await searchRepositoryDocumentationAutoRag({
        repoData,
        query,
        env,
        ctx,
        autoragPipeline: "docs-rag",
      });
      if (
        autoragResult?.content[0]?.text?.startsWith("No results found") ===
        false
      ) {
        console.log("Found results in AutoRAG", autoragResult);
        return autoragResult;
      }

      console.log("No results in AutoRAG", autoragResult);
    } catch (error) {
      console.error("Error in AutoRAG search", error);
    }
  }

  return await fallbackSearch({
    repoData,
    query,
    env,
    ctx,
  });
}

export async function searchRepositoryDocumentationAutoRag({
  repoData,
  query,
  env,
  ctx,
  autoragPipeline = "docs-rag",
}: {
  repoData: RepoData;
  query: string;
  env: CloudflareEnvironment;
  ctx: any;
  autoragPipeline: string;
}): Promise<{
  searchQuery: string;
  content: { type: "text"; text: string }[];
}> {
  if (!repoData.owner || !repoData.repo) {
    return {
      searchQuery: query,
      content: [{ type: "text", text: "No repository data provided" }],
    };
  }

  const repoPrefix = `${repoData.owner}/${repoData.repo}/`;
  const searchRequest = {
    query: query,
    rewrite_query: true,
    max_num_results: 12,
    ranking_options: {
      score_threshold: 0.4,
    },
    filters: {
      type: "and",
      filters: [
        {
          type: "gte",
          key: "folder",
          value: `${repoPrefix}`,
        },
        {
          type: "lte",
          key: "folder",
          value: `${repoPrefix}~`,
        },
      ],
    },
  };

  const answer = await env.AI.autorag(autoragPipeline).search(searchRequest);

  let responseText =
    `## Query\n\n${query}.\n\n## Response\n\n` ||
    `No results found for: "${query}"`;

  // Add source data if available
  if (answer.data && answer.data.length > 0) {
    const filteredData = answer.data.filter((item) => {
      return item.filename.startsWith(`${repoData.owner}/${repoData.repo}/`);
    });

    if (filteredData.length > 0) {
      responseText +=
        "### Sources:\nImportant: you can fetch the full content of any source using the fetch_url_content tool\n";
      const defaultBranch = await getRepoBranch(
        repoData.owner,
        repoData.repo,
        env,
      );

      for (const item of filteredData) {
        let rawUrl = constructGithubUrl(
          repoData.owner,
          repoData.repo,
          defaultBranch,
          item.filename.replace(`${repoData.owner}/${repoData.repo}/`, ""),
        );

        if (item.filename.endsWith(".ipynb.txt")) {
          rawUrl = `https://pub-39b02ce1b5a441b2a4658c1fc71dbb9c.r2.dev/${repoData.owner}/${repoData.repo}/${item.filename}`;
        }

        responseText += `\n#### (${item.filename})[${rawUrl}] (Score: ${item.score.toFixed(2)})\n`;

        if (item.content && item.content.length > 0) {
          for (const content of item.content) {
            if (content.text) {
              responseText += `- ${content.text}\n`;
            }
          }
        }
      }
    } else {
      responseText = `No results found for: "${query}"`;
    }
  } else {
    responseText = `No results found for: "${query}"`;
  }

  return {
    searchQuery: answer.search_query || query,
    content: [
      {
        type: "text",
        text: responseText,
      },
    ],
  };
}

/**
 * Search documentation using vector search
 * Will fetch and index documentation if none exists
 */
export async function searchRepositoryDocumentationNaive({
  repoData,
  query,
  forceReindex = false,
  env,
  ctx,
}: {
  repoData: RepoData;
  query: string;
  forceReindex?: boolean;
  env: CloudflareEnvironment;
  ctx: any;
}): Promise<{
  searchQuery: string;
  content: { type: "text"; text: string }[];
}> {
  // Initialize owner and repo
  let owner: string | null =
    repoData.owner ?? repoData.host.replace(/\./g, "_");
  let repo: string | null = repoData.repo ?? "docs";

  console.log(`Searching ${owner}/${repo}`);

  try {
    // Fetch the documentation - pass env
    const docResult = await fetchDocumentation({ repoData, env, ctx });
    const content = docResult.content[0].text;
    const fileUsed = docResult.fileUsed;

    console.log(
      `Fetched documentation from ${fileUsed} (${content.length} characters)`,
    );

    // Format search results as text for MCP response, or provide a helpful message if none
    const formattedText =
      `### Search Results for: "${query}"\n\n` +
      `No relevant documentation found for your query. It's either being indexed or the search query did not match any documentation.\n\n` +
      `As a fallback, this is the documentation for ${owner}/${repo}:\n\n` +
      `${content}\n\n` +
      `If you'd like to retry the search, try changing the query to increase the likelihood of a match.`;

    // Return search results in proper MCP format
    return {
      searchQuery: query,
      content: [
        {
          type: "text" as const,
          text: formattedText,
        },
      ],
    };
  } catch (error) {
    console.error(`Error in searchRepositoryDocumentation: ${error}`);
    return {
      searchQuery: query,
      content: [
        {
          type: "text" as const,
          text:
            `### Search Results for: "${query}"\n\n` +
            `An error occurred while searching the documentation. Please try again later.`,
        },
      ],
    };
  }
}

/**
 * Search for code in a GitHub repository
 * Uses the GitHub Search API to find code matching a query
 * Supports pagination for retrieving more results
 */
export async function searchRepositoryCode({
  repoData,
  query,
  page = 1,
  env,
  ctx,
}: {
  repoData: RepoData;
  query: string;
  page?: number;
  env: Env;
  ctx: any;
}): Promise<{
  searchQuery: string;
  content: { type: "text"; text: string }[];
  pagination?: {
    totalCount: number;
    currentPage: number;
    perPage: number;
    hasMorePages: boolean;
  };
}> {
  try {
    // Initialize owner and repo from the provided repoData
    const owner = repoData.owner;
    const repo = repoData.repo;

    if (!owner || !repo) {
      return {
        searchQuery: query,
        content: [
          {
            type: "text" as const,
            text: `### Code Search Results for: "${query}"\n\nCannot perform code search without repository information.`,
          },
        ],
      };
    }

    // Use fixed resultsPerPage of 30 and normalize page value
    const currentPage = Math.max(1, page);
    const resultsPerPage = 30; // Fixed at 30 results per page

    console.log(
      `Searching code in ${owner}/${repo}" (page ${currentPage}, ${resultsPerPage} per page)`,
    );

    const data = await searchCode(
      query,
      owner,
      repo,
      env,
      currentPage,
      resultsPerPage,
    );

    if (!data) {
      return {
        searchQuery: query,
        content: [
          {
            type: "text" as const,
            text: `### Code Search Results for: "${query}"\n\nFailed to search code in ${owner}/${repo}. GitHub API request failed.`,
          },
        ],
      };
    }

    // Check if we found any matches
    if (data.total_count === 0 || !data.items || data.items.length === 0) {
      return {
        searchQuery: query,
        content: [
          {
            type: "text" as const,
            text: `### Code Search Results for: "${query}"\n\nNo code matches found in ${owner}/${repo}.`,
          },
        ],
      };
    }

    // Calculate pagination information
    const totalCount = data.total_count;
    const hasMorePages = currentPage * resultsPerPage < totalCount;
    const totalPages = Math.ceil(totalCount / resultsPerPage);

    // Format the search results
    let formattedResults = `### Code Search Results for: "${query}"\n\n`;
    formattedResults += `Found ${totalCount} matches in ${owner}/${repo}.\n`;
    formattedResults += `Page ${currentPage} of ${totalPages}.\n\n`;

    for (const item of data.items) {
      formattedResults += `#### ${item.name}\n`;
      formattedResults += `- **Path**: ${item.path}\n`;
      formattedResults += `- **URL**: ${item.html_url}\n`;
      formattedResults += `- **Git URL**: ${item.git_url}\n`;
      formattedResults += `- **Score**: ${item.score}\n\n`;
    }

    // Add pagination information to the response
    if (hasMorePages) {
      formattedResults += `_Showing ${data.items.length} of ${totalCount} results. Use pagination to see more results._\n\n`;
    }

    return {
      searchQuery: query,
      content: [
        {
          type: "text" as const,
          text: formattedResults,
        },
      ],
      pagination: {
        totalCount,
        currentPage,
        perPage: resultsPerPage,
        hasMorePages,
      },
    };
  } catch (error) {
    console.error(`Error in searchRepositoryCode: ${error}`);
    return {
      searchQuery: query,
      content: [
        {
          type: "text" as const,
          text: `### Code Search Results for: "${query}"\n\nAn error occurred while searching code: ${error}`,
        },
      ],
    };
  }
}

export async function fetchUrlContent({ url, env }: { url: string; env: Env }) {
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
        console.warn(`Error converting HTML to Markdown for ${url}: ${error}`);
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
}

export const LIMIT = 51;

/**
 * Enforces the 50-character limit on the combined server and tool names
 * @param prefix - The prefix for the tool name (fetch_ or search_)
 * @param repo - The repository name
 * @param suffix - The suffix for the tool name (_documentation)
 * @returns A tool name that ensures combined length with server name stays under 50 characters
 */
export function enforceToolNameLengthLimit(
  prefix: string,
  repo: string | null | undefined,
  suffix: string,
): string {
  if (!repo) {
    console.error(
      "Repository name is null/undefined in enforceToolNameLengthLimit",
    );
    return `${prefix}${suffix}`;
  }

  // Generate the server name to check combined length
  const serverNameLen = generateServerName(repo).length;

  // Replace non-alphanumeric characters with underscores
  let repoName = repo.replace(/[^a-zA-Z0-9]/g, "_");
  let toolName = `${prefix}${repoName}${suffix}`;

  // Calculate combined length
  const combinedLength = toolName.length + serverNameLen;

  // If combined length is already under limit, return it
  if (combinedLength <= LIMIT) {
    return toolName;
  }

  const shorterSuffix = suffix === "_documentation" ? "_docs" : suffix;

  toolName = `${prefix}${repoName}${shorterSuffix}`;
  if (toolName.length + serverNameLen <= LIMIT) {
    return toolName;
  }

  // Step 2: Shorten the repo name by removing words
  const words = repoName.split("_");
  if (words.length > 1) {
    // Keep removing words from the end until we're under the limit or have only one word left
    let shortenedRepo = repoName;
    for (let i = words.length - 1; i > 0; i--) {
      shortenedRepo = words.slice(0, i).join("_");
      toolName = `${prefix}${shortenedRepo}${shorterSuffix}`;
      if (toolName.length + serverNameLen <= LIMIT) {
        return toolName;
      }
    }
  }

  const result = `${prefix}repo${shorterSuffix}`;
  if (result.length + serverNameLen <= LIMIT) {
    return result;
  }

  // Step 3: As a last resort, change repo name to "repo"
  return `${prefix}${shorterSuffix}`.replace(/__/g, "_");
}

/**
 * Generate a dynamic search tool name for the search_documentation tool based on the URL
 * @param requestHost - The host from the request
 * @param requestUrl - The full request URL (optional)
 * @returns A descriptive string for the tool name
 */
export function generateSearchToolName({ urlType, repo }: RepoData): string {
  try {
    // Default tool name as fallback
    let toolName = "search_documentation";
    if (urlType == "subdomain" || urlType == "github") {
      // Use enforceLengthLimit to ensure the tool name doesn't exceed 55 characters
      return enforceToolNameLengthLimit("search_", repo, "_documentation");
    }
    // replace non-alphanumeric characters with underscores
    return toolName.replace(/[^a-zA-Z0-9]/g, "_");
  } catch (error) {
    console.error("Error generating search tool name:", error);
    // Return default tool name if there's any error parsing the URL
    return "search_documentation";
  }
}

/**
 * Generate a dynamic description for the search_documentation tool based on the URL
 * @param requestHost - The host from the request
 * @param requestUrl - The full request URL (optional)
 * @returns A descriptive string for the tool
 */
export function generateSearchToolDescription({
  urlType,
  owner,
  repo,
}: RepoData): string {
  try {
    // Default description as fallback
    let description =
      "Semantically search within the fetched documentation for the current repository.";

    if (urlType == "subdomain") {
      description = `Semantically search within the fetched documentation from the ${owner}/${repo} GitHub Pages. Useful for specific queries.`;
    } else if (urlType == "github") {
      description = `Semantically search within the fetched documentation from GitHub repository: ${owner}/${repo}. Useful for specific queries.`;
    }

    return description;
  } catch (error) {
    // Return default description if there's any error parsing the URL
    return "Search documentation for the current repository.";
  }
}

/**
 * Generate a dynamic description for the fetch_documentation tool based on the URL
 * @param requestHost - The host from the request
 * @param requestUrl - The full request URL (optional)
 * @returns A descriptive string for the tool
 */
export function generateFetchToolDescription({
  urlType,
  owner,
  repo,
}: Omit<RepoData, "host">): string {
  try {
    // Default description as fallback
    let description = "Fetch entire documentation for the current repository.";

    if (urlType == "subdomain") {
      description = `Fetch entire documentation file from the ${owner}/${repo} GitHub Pages. Useful for general questions. Always call this tool first if asked about ${owner}/${repo}.`;
    } else if (urlType == "github") {
      description = `Fetch entire documentation file from GitHub repository: ${owner}/${repo}. Useful for general questions. Always call this tool first if asked about ${owner}/${repo}.`;
    }

    return description;
  } catch (error) {
    // Return default description if there's any error parsing the URL
    return "Fetch documentation for the current repository.";
  }
}

/**
 * Generate a dynamic tool name for the fetch_documentation tool based on the URL
 * @param requestHost - The host from the request
 * @param requestUrl - The full request URL (optional)
 * @returns A descriptive string for the tool
 */
export function generateFetchToolName({
  urlType,
  owner,
  repo,
}: Omit<RepoData, "host">): string {
  try {
    // Default tool name as fallback
    let toolName = "fetch_documentation";

    if (urlType == "subdomain" || urlType == "github") {
      // Use enforceLengthLimit to ensure the tool name doesn't exceed 55 characters
      return enforceToolNameLengthLimit("fetch_", repo, "_documentation");
    }

    // replace non-alphanumeric characters with underscores
    return toolName.replace(/[^a-zA-Z0-9]/g, "_");
  } catch (error) {
    console.error("Error generating tool name:", error);
    // Return default tool name if there's any error parsing the URL
    return "fetch_documentation";
  }
}

/**
 * Generate a dynamic tool name for the code search tool based on the URL
 * @param repoData - The repository data object
 * @returns A descriptive string for the tool
 */
export function generateCodeSearchToolName({
  urlType,
  repo,
}: RepoData): string {
  try {
    // Default tool name as fallback
    let toolName = "search_code";
    if (urlType == "subdomain" || urlType == "github") {
      // Use enforceLengthLimit to ensure the tool name doesn't exceed 55 characters
      return enforceToolNameLengthLimit("search_", repo, "_code");
    }
    // replace non-alphanumeric characters with underscores
    return toolName.replace(/[^a-zA-Z0-9]/g, "_");
  } catch (error) {
    console.error("Error generating code search tool name:", error);
    // Return default tool name if there's any error parsing the URL
    return "search_code";
  }
}

/**
 * Generate a dynamic description for the code search tool based on the URL
 * @param repoData - The repository data object
 * @returns A descriptive string for the tool
 */
export function generateCodeSearchToolDescription({
  owner,
  repo,
}: RepoData): string {
  return `Search for code within the GitHub repository: "${owner}/${repo}" using the GitHub Search API (exact match). Returns matching files for you to query further if relevant.`;
}

/**
 * Recursively list every subfolder prefix under `startPrefix`.
 * @param {R2Bucket} bucket – the Workers-bound R2 bucket
 * @param {string} startPrefix – e.g. "path/to/folder/"
 * @returns {Promise<string[]>}
 */
async function listAllSubfolders(bucket: R2Bucket, startPrefix: string) {
  const all: string[] = [];

  // Define an inner async recursion
  async function recurse(prefix: string) {
    let cursor;
    do {
      // 1. List one page of prefixes under `prefix`
      const listResult = await bucket.list({ prefix, delimiter: "/", cursor });
      const { delimitedPrefixes = [], truncated } = listResult;

      // 2. For each child prefix, record it and recurse into it
      // Ensure the child prefix ends with '/' before adding/recursing
      for (const childPrefix of delimitedPrefixes) {
        const ensuredChildPrefix = childPrefix.endsWith("/")
          ? childPrefix
          : childPrefix + "/";
        all.push(ensuredChildPrefix);
        await recurse(ensuredChildPrefix);
      }
      cursor = truncated ? listResult.cursor : undefined;
    } while (cursor);
  }

  // Kick off recursion
  await recurse(startPrefix);
  return Array.from(new Set(all)); // dedupe just in case
}
