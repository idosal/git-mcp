import type { RepoData } from "../../shared/repoData.js";
import { fetchFileFromGitHub, searchGitHubRepo } from "../utils/github.js";
import { formatSearchResults } from "../utils/helpers.js";
import { fetchFileWithRobotsTxtCheck } from "../utils/robotsTxt.js";
import { getCachedFilePath, cacheFilePath } from "../utils/cache.js";
import {
  searchDocumentation,
  storeDocumentationVectors,
} from "../utils/vectorStore.js";
import { cacheIsIndexed, getIsIndexedFromCache } from "../utils/cache.js";
import htmlToMd from "html-to-md";
import { searchCode } from "../utils/githubClient.js";

// Add env parameter to access Cloudflare's bindings
export async function fetchDocumentation({
  repoData,
  env,
}: {
  repoData: RepoData;
  env: any;
}): Promise<{
  fileUsed: string;
  content: { type: "text"; text: string }[];
}> {
  const { owner, repo, urlType } = repoData;

  // Initialize fileUsed to prevent "used before assigned" error
  let fileUsed = "unknown";
  let content: string | null = null;
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
          baseURL + "readme.md",
          env,
        );

        if (readmeResult.blockedByRobots) {
          blockedByRobots = true;
          console.log(`Access to ${baseURL}readme.md disallowed by robots.txt`);
        } else if (readmeResult.content) {
          content = readmeResult.content;
          fileUsed = "readme.md";
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
    // First check if we have a cached path for llms.txt
    const cachedPath = await getCachedFilePath(owner, repo, env);
    if (cachedPath) {
      content = await fetchFileFromGitHub(
        owner,
        repo,
        cachedPath.branch,
        cachedPath.path,
        env,
      );
      if (content) {
        fileUsed =
          "${cachedPath.path} (${cachedPath.branch} branch, from cache)";
      }
    }

    // If no cached path or cached path failed, try static paths
    if (!content) {
      console.log(`No cached path for ${owner}/${repo}, trying static paths`);
      const possibleLocations = [
        "docs/docs/llms.txt", // Current default
        "llms.txt", // Root directory
        "docs/llms.txt", // Common docs folder
        "documentation/llms.txt", // Alternative docs folder
      ];

      // Create array of all location+branch combinations to try
      const fetchPromises = possibleLocations.flatMap((location) => [
        {
          promise: fetchFileFromGitHub(owner, repo, "main", location, env),
          location,
          branch: "main",
        },
        {
          promise: fetchFileFromGitHub(owner, repo, "master", location, env),
          location,
          branch: "master",
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
        // Check main branch first (matching original priority)
        const mainResult = results.find(
          (r) => r.location === location && r.content !== null,
        );
        if (mainResult) {
          content = mainResult.content;
          fileUsed = `${mainResult.location} (${mainResult.branch} branch)`;
          await cacheFilePath(
            owner,
            repo,
            "llms.txt",
            mainResult.location,
            mainResult.branch,
            env,
          );
          break;
        }
      }

      // Fallback to GitHub Search API if static paths don't work for llms.txt
      if (!content) {
        console.log(
          `llms.txt not found in static paths, trying GitHub Search API`,
        );

        content = await searchGitHubRepo(owner, repo, "llms.txt", env);
        if (content) {
          fileUsed = "llms.txt (found via GitHub Search API)";
        }
      }
    }

    // Fallback to README.md if llms.txt not found in any location
    if (!content) {
      console.log(`llms.txt not found, trying README.md`);
      // Only use static approach for README, no search API
      // Try main branch first
      content = await fetchFileFromGitHub(
        owner,
        repo,
        "main",
        "README.md",
        env,
      );
      fileUsed = "readme.md (main branch)";

      // If not found, try master branch
      if (!content) {
        content = await fetchFileFromGitHub(
          owner,
          repo,
          "master",
          "README.md",
          env,
        );
        fileUsed = "readme.md (master branch)";
      }
    }

    if (!content) {
      console.error(`Failed to find documentation for ${owner}/${repo}`);
    }

    // Store documentation in vector database for later search
    if (content && owner && repo) {
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
  }

  if (!content) {
    content = "No documentation found.";
    fileUsed = "generated";
  }

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

/**
 * Search documentation using vector search
 * Will fetch and index documentation if none exists
 */
export async function searchRepositoryDocumentation({
  repoData,
  query,
  forceReindex = false,
  env,
}: {
  repoData: RepoData;
  query: string;
  forceReindex?: boolean;
  env: any;
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
      const docResult = await fetchDocumentation({ repoData, env });
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
}: {
  repoData: RepoData;
  query: string;
  page?: number;
  env: any;
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

export async function fetchUrlContent({ url, env }: { url: string; env: any }) {
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
