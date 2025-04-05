import type { RepoData } from "../../shared/repoData.js";
import { fetchFileFromGitHub, searchGitHubRepo } from "../utils/github.js";
import { formatSearchResults } from "../utils/helpers.js";
import { fetchFileWithRobotsTxtCheck } from "../utils/robotsTxt.js";
import { getCachedFilePath, cacheFilePath } from "../utils/upstash.js";
import {
  searchDocumentation,
  storeDocumentationVectors,
} from "../utils/vectorStore.js";
import htmlToMd from "html-to-md";

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
  const { owner, repo, host, urlType } = repoData;

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
    const llmsResult = await fetchFileWithRobotsTxtCheck(baseURL + "llms.txt");

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
      const indexResult = await fetchFileWithRobotsTxtCheck(baseURL);

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
    const cachedPath = await getCachedFilePath(owner, repo, "llms.txt");
    if (cachedPath) {
      content = await fetchFileFromGitHub(
        owner,
        repo,
        "cachedPath.branch",
        "cachedPath.path",
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
          promise: fetchFileFromGitHub(owner, repo, "main", location),
          location,
          branch: "main",
        },
        {
          promise: fetchFileFromGitHub(owner, repo, "master", location),
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
      content = await fetchFileFromGitHub(owner, repo, "main", "README.md");
      fileUsed = "readme.md (main branch)";

      // If not found, try master branch
      if (!content) {
        content = await fetchFileFromGitHub(owner, repo, "master", "README.md");
        fileUsed = "readme.md (master branch)";
      }
    }

    if (!content) {
      console.error(`Failed to find documentation for ${owner}/${repo}`);
    }

    // Store documentation in vector database for later search
    if (content && owner && repo) {
      try {
        // Pass the Vectorize binding from env
        console.log("ENV VECTORIZE", env);
        await storeDocumentationVectors(
          owner,
          repo,
          content,
          fileUsed,
          env.VECTORIZE,
        );
        console.log(`Stored documentation vectors for ${owner}/${repo}`);
      } catch (error) {
        console.error(`Failed to store documentation vectors: ${error}`);
        // Continue despite vector storage failure
      }
    }
  }
  // Default/fallback case
  else {
    // Map "gitmcp.io" to "github.io"
    const mappedHost = host.replace("gitmcp.io", "github.io");
    let baseURL = `https://${mappedHost}/${repo}`;
    if (!baseURL.endsWith("/")) {
      baseURL += "/";
    }

    // Try fetching llms.txt with robots.txt check
    const llmsResult = await fetchFileWithRobotsTxtCheck(baseURL + "llms.txt");

    if (llmsResult.blockedByRobots) {
      blockedByRobots = true;
    } else if (llmsResult.content) {
      content = llmsResult.content;
      fileUsed = "llms.txt";
    }

    // If llms.txt not available or blocked, try readme.md
    if (!content && !blockedByRobots) {
      const readmeResult = await fetchFileWithRobotsTxtCheck(
        baseURL + "readme.md",
      );

      if (readmeResult.blockedByRobots) {
        blockedByRobots = true;
      } else if (readmeResult.content) {
        content = readmeResult.content;
        fileUsed = "readme.md";
      }
    }

    // If any path was blocked by robots.txt, return appropriate message
    if (blockedByRobots) {
      content =
        "Access to this GitHub Pages site is restricted by robots.txt. GitMCP respects robots.txt directives.";
      fileUsed = "robots.txt restriction";
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

    // If no results or forceReindex is true, we need to index the documentation
    if (results.length === 0 || forceReindex) {
      console.log(
        `${
          forceReindex ? "Force reindexing" : "No search results found"
        } for in ${owner}/${repo}, fetching documentation first`,
      );
      isFirstSearch = true;

      // Fetch the documentation - pass env
      const docResult = await fetchDocumentation({ repoData, env });
      const content = docResult.content[0].text;
      const fileUsed = docResult.fileUsed;

      console.log(
        `Fetched documentation from ${fileUsed} (${content.length} characters)`,
      );

      // Only index and search if we got actual content
      if (content && owner && repo && content !== "No documentation found.") {
        try {
          // Wait for vectors to be stored - pass the Vectorize binding
          const vectorCount = await storeDocumentationVectors(
            owner,
            repo,
            content,
            fileUsed,
            env.VECTORIZE,
          );
          console.log(
            `Successfully indexed ${vectorCount} document chunks for ${owner}/${repo}`,
          );

          // Wait a short time to ensure indexing is complete
          await new Promise((resolve) => setTimeout(resolve, 1000));

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
                    // `We've just indexed the documentation for this repository (${vectorCount} chunks). ` +
                    // `Documentation:\n\n` +
                    docResult.content[0].text,
                  // `Please try your search again in a moment for more fine-grained`,
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
