import type { RepoData } from "../../shared/repoData.js";
import {
  constructGithubUrl,
  fetchFileFromGitHub,
  getRepoBranch,
  searchGitHubRepo,
} from "../utils/github.js";
import { formatSearchResults } from "../utils/helpers.js";
import { fetchFileWithRobotsTxtCheck } from "../utils/robotsTxt.js";
import {
  searchDocumentation,
  storeDocumentationVectors,
} from "../utils/vectorStore.js";
import { cacheIsIndexed, getIsIndexedFromCache } from "../utils/cache.js";
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
  const cacheTTL = 15 * 60; // 15 minutes in seconds

  // Try fetching from cache first
  if (owner && repo) {
    const cachedResult = await getCachedFetchDocResult(owner, repo, env);
    if (cachedResult) {
      console.log(
        `Returning cached fetchDocumentation result for ${owner}/${repo}`,
      );
      // Optional: Extend cache TTL if needed, or just return
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
        console.log(`No pre-generated llms.txt found for ${owner}/${repo}`);
      }
    }

    // Fallback to README.md if llms.txt not found in any location (GitHub or R2)
    if (!content) {
      console.log(`llms.txt not found, trying README.md`);
      // Use static approach for README
      const readmeLocation = getReadmeMDLocationByRepoData(repoData);
      // Ensure docsBranch is available (should be fetched above)
      if (!docsBranch) {
        docsBranch = await getRepoBranch(owner, repo, env);
      }

      content = await fetchFileFromGitHub(
        owner,
        repo,
        docsBranch,
        readmeLocation,
        env,
        false,
      );
      fileUsed = "README.md";
      docsPath = constructGithubUrl(owner, repo, docsBranch, "README.md");
    }

    if (!content) {
      console.error(`Failed to find documentation for ${owner}/${repo}`);
    }

    if (content && owner && repo) {
      ctx.waitUntil(
        indexDocumentation(
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
  }

  if (!content) {
    content = "No documentation found.";
    fileUsed = "generated";
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

  // Cache the final result before returning
  if (owner && repo) {
    ctx.waitUntil(
      cacheFetchDocResult(owner, repo, result, cacheTTL, env).catch((error) => {
        console.warn(`Failed to cache fetch documentation result: ${error}`);
      }),
    );
  }

  return result;
}

async function indexDocumentation(
  owner: string,
  repo: string,
  content: string,
  fileUsed: string,
  docsPath: string,
  docsBranch: string,
  env: Env,
) {
  try {
    if (env.MY_QUEUE) {
      // Construct repo URL and llms URL if applicable
      const repoUrl = `https://github.com/${owner}/${repo}`;

      // Prepare and send message to queue
      const message = {
        owner,
        repo,
        repo_url: repoUrl,
        file_url: docsPath,
        content_length: content.length,
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
    console.warn(
      `Failed to enqueue documentation request for ${owner}/${repo}`,
      error,
    );
  }

  try {
    // First check if vectors exist in KV cache
    let vectorsExist = await getIsIndexedFromCache(owner, repo, env);

    // Only store vectors if they don't exist yet
    if (!vectorsExist) {
      // Pass the Vectorize binding from env
      await storeDocumentationVectors(
        owner,
        repo,
        content,
        fileUsed,
        env.VECTORIZE,
      );

      // Update the cache to indicate vectors now exist
      await cacheIsIndexed(owner, repo, true, env);
      console.log(`Stored documentation vectors for ${owner}/${repo}`);
    } else {
      console.log(
        `Documentation vectors already exist for ${owner}/${repo}, skipping indexing`,
      );
    }
  } catch (error) {
    console.error(`Failed to store documentation vectors: ${error}`);
    // Continue despite vector storage failure
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
    const autoragResult = await searchRepositoryDocumentationAutoRag({
      repoData,
      query,
      env,
      ctx,
      autoragPipeline: "docs-rag",
    });
    if (
      autoragResult?.content[0]?.text?.includes("No results found") === false
    ) {
      console.log("Found results in AutoRAG", autoragResult);
      return autoragResult;
    }
  }

  console.log("No results in AutoRAG, falling back to naive search");
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

  const answer = await env.AI.autorag(autoragPipeline).search({
    query: query,
    rewrite_query: true,
    max_num_results: 10,
    ranking_options: {
      score_threshold: 0.5,
    },
    filters: {
      type: "and",
      filters: [
        {
          type: "gte",
          key: "folder",
          value: `${repoData.owner}/${repoData.repo}/`,
        },
        {
          type: "lt",
          key: "folder",
          value: `${repoData.owner}/${repoData.repo}/~`,
        },
      ],
    },
  });

  // console.log(answer);

  let responseText =
    `## Query\n\n${query}.\n\n## Response\n\n` ||
    `No results found for: "${query}"`;

  // Add source data if available
  if (answer.data && answer.data.length > 0) {
    responseText += "\n\n### Sources:\n";
    const defaultBranch = await getRepoBranch(
      repoData.owner,
      repoData.repo,
      env,
    );

    for (const item of answer.data) {
      const rawGithubUrl = constructGithubUrl(
        repoData.owner,
        repoData.repo,
        defaultBranch,
        item.filename.replace(`${repoData.owner}/${repoData.repo}/`, ""),
      );
      responseText += `\n#### (${item.filename})[${rawGithubUrl}] (Score: ${item.score.toFixed(2)})\n`;

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

  // First, check if this is the initial search for this repo/owner or if reindexing is forced
  let isFirstSearch = false;

  try {
    // Search for documentation using vector search - pass the Vectorize binding
    let results = await searchDocumentation(
      owner,
      repo,
      query,
      5,
      env.VECTORIZE,
    );

    console.log(`Initial search found ${results.length} results"`, results);

    // If no results or forceReindex is true, we need to index the documentation
    if (results.length === 0 || forceReindex) {
      console.log(
        `${
          forceReindex ? "Force reindexing" : "No search results found"
        } for in ${owner}/${repo}, fetching documentation first`,
      );

      isFirstSearch = true;

      await cacheIsIndexed(owner, repo, false, env);

      // Fetch the documentation - pass env
      const docResult = await fetchDocumentation({ repoData, env, ctx });
      const content = docResult.content[0].text;
      const fileUsed = docResult.fileUsed;

      console.log(
        `Fetched documentation from ${fileUsed} (${content.length} characters)`,
      );

      // Only search if we found content
      if (content && owner && repo && content !== "No documentation found.") {
        try {
          // Search again after indexing - pass the Vectorize binding
          results = await searchDocumentation(
            owner,
            repo,
            query,
            5,
            env.VECTORIZE,
          );
          console.log(
            `Re-search after indexing found ${results.length} results`,
          );

          // If still no results on first search, send a message about indexing
          if (results.length === 0 && isFirstSearch) {
            return {
              searchQuery: query,
              content: [
                {
                  type: "text" as const,
                  text:
                    `### Search Results for: "${query}"\n\n` +
                    // fallback to content
                    docResult.content[0].text,
                },
              ],
            };
          }
        } catch (error) {
          console.error(`Error indexing documentation: ${error}`);

          // If there was an indexing error on first search, inform the user
          if (isFirstSearch) {
            return {
              searchQuery: query,
              content: [
                {
                  type: "text" as const,
                  text:
                    `### Search Results for: "${query}"\n\n` +
                    `We encountered an issue while indexing the documentation. ` +
                    `Please try your search again in a moment.`,
                },
              ],
            };
          }
        }
      }
    }

    // Format search results as text for MCP response, or provide a helpful message if none
    let formattedText;
    if (results.length > 0) {
      formattedText = formatSearchResults(results, query);
    } else {
      // Provide more helpful guidance when no results are found
      formattedText =
        `### Search Results for: "${query}"\n\n` +
        `No relevant documentation found for your query. The documentation for this repository has been indexed, ` +
        `but no sections matched your specific search terms.\n\n` +
        `Try:\n` +
        `- Using different keywords\n` +
        `- Being more specific about what you're looking for\n` +
        `- Checking for basic information like "What is ${repo}?"\n` +
        `- Using common terms like "installation", "tutorial", or "example"\n`;
    }

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
    const fetchToolName = generateFetchToolName({
      urlType,
      owner,
      repo,
    });

    // Default description as fallback
    let description =
      "Semantically search within the fetched documentation for the current repository.";

    if (urlType == "subdomain") {
      description = `Semantically search within the fetched documentation from the ${owner}/${repo} GitHub Pages. Useful for specific queries. Don't call if you already used ${fetchToolName}.`;
    } else if (urlType == "github") {
      description = `Semantically search within the fetched documentation from GitHub repository: ${owner}/${repo}. Useful for specific queries. Don't call if you already used ${fetchToolName}.`;
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
      description = `Fetch entire documentation file from the ${owner}/${repo} GitHub Pages. Useful for general questions.`;
    } else if (urlType == "github") {
      description = `Fetch entire documentation file from GitHub repository: ${owner}/${repo}. Useful for general questions.`;
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

const readmeMdLocations: Record<string, `${string}/${string}`> = {
  "vercel/next.js": "packages/next/README.md",
};

function getReadmeMDLocationByRepoData(repoData: RepoData): string {
  if (!repoData.owner || !repoData.repo) {
    return "README.md";
  }
  const readmeLocation =
    readmeMdLocations[`${repoData.owner}/${repoData.repo}`];
  return readmeLocation ?? "README.md";
}
