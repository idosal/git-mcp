import { getRepoData } from "../../shared/repoData.js";
import {
  getCachedFilePath,
  cacheFilePath,
  getCachedRobotsTxt,
  cacheRobotsTxt,
  RobotsRule,
} from "../utils/upstash.js";
import {
  searchDocumentation,
  storeDocumentationVectors,
} from "../utils/vectorStore.js";
import htmlToMd from "html-to-md";

/**
 * Parse robots.txt content into structured rules
 * @param content - The content of robots.txt
 * @returns Array of parsed rules
 */
function parseRobotsTxt(content: string): RobotsRule[] {
  const lines = content.split("\n");
  const rules: RobotsRule[] = [];

  let currentRule: RobotsRule | null = null;

  for (const line of lines) {
    const trimmedLine = line.trim();

    // Skip comments and empty lines
    if (!trimmedLine || trimmedLine.startsWith("#")) {
      continue;
    }

    // Split into directive and value
    const [directive, ...valueParts] = trimmedLine.split(":");
    const value = valueParts.join(":").trim();

    if (!directive || !value) {
      continue;
    }

    const directiveLower = directive.trim().toLowerCase();

    // Start a new rule when encountering a User-agent directive
    if (directiveLower === "user-agent") {
      if (currentRule && currentRule.userAgent) {
        rules.push(currentRule);
      }
      currentRule = { userAgent: value, disallow: [], allow: [] };
    }
    // Add disallow paths
    else if (directiveLower === "disallow" && currentRule) {
      currentRule.disallow.push(value);
    }
    // Add allow paths
    else if (directiveLower === "allow" && currentRule) {
      currentRule.allow.push(value);
    }
  }

  // Add the last rule if exists
  if (currentRule && currentRule.userAgent) {
    rules.push(currentRule);
  }

  return rules;
}

/**
 * Check if a path is allowed according to robots.txt rules
 * @param rules - The parsed robots.txt rules
 * @param path - The path to check
 * @returns boolean indicating if access is allowed
 */
function isPathAllowed(rules: RobotsRule[], path: string): boolean {
  // Path should start with a slash
  if (!path.startsWith("/")) {
    path = "/" + path;
  }

  // First find the applicable rule set (for * or for our user agent)
  // We'll use * since we don't specify a specific user agent
  let applicableRules = rules.find((rule) => rule.userAgent === "*");

  // If no wildcard rules, check if any rules apply at all
  if (!applicableRules && rules.length > 0) {
    applicableRules = rules[0]; // Use the first rule as default
  }

  // If no applicable rules or empty rules, allow access
  if (
    !applicableRules ||
    (applicableRules.disallow.length === 0 &&
      applicableRules.allow.length === 0)
  ) {
    return true;
  }

  // Check specific allow rules (these take precedence over disallow)
  for (const allowPath of applicableRules.allow) {
    if (path.startsWith(allowPath)) {
      return true;
    }
  }

  // Check disallow rules
  for (const disallowPath of applicableRules.disallow) {
    if (disallowPath === "/" || path.startsWith(disallowPath)) {
      return false;
    }
  }

  // Default to allow if no disallow rules match
  return true;
}

/**
 * Check if a specific URL is allowed according to robots.txt rules
 * @param domain - The domain to check
 * @param path - The complete path to check including the file (should start with /)
 * @returns boolean indicating if access is allowed
 */
async function checkRobotsTxt(domain: string, path: string): Promise<boolean> {
  try {
    // Check Upstash cache first
    const cachedRules = await getCachedRobotsTxt(domain);

    if (cachedRules) {
      console.log(
        `Using cached robots.txt rules for ${domain} to check ${path}`,
      );
      return isPathAllowed(cachedRules, path);
    }

    // Fetch robots.txt if not in cache
    const robotsTxtUrl = `https://${domain}/robots.txt`;
    console.log(`Fetching robots.txt from ${robotsTxtUrl}`);
    const response = await fetch(robotsTxtUrl);

    // If robots.txt doesn't exist or can't be accessed, allow access by default
    if (!response.ok) {
      console.log(`No robots.txt found for ${domain} or couldn't be accessed`);
      // Cache empty rules for domains without robots.txt
      await cacheRobotsTxt(domain, []);
      return true;
    }

    const content = await response.text();
    const rules = parseRobotsTxt(content);

    // Cache the parsed rules in Upstash
    await cacheRobotsTxt(domain, rules);
    console.log(`Cached robots.txt rules for ${domain}`);

    return isPathAllowed(rules, path);
  } catch (error) {
    console.warn(`Error checking robots.txt for ${domain}:`, error);
    // In case of errors, allow access by default
    return true;
  }
}

/**
 * Safely fetch a file after checking robots.txt permissions
 * @param url - Complete URL to fetch
 * @returns File content or null if not allowed or not found
 */
async function fetchFileWithRobotsTxtCheck(
  url: string,
): Promise<{ content: string | null; blockedByRobots: boolean }> {
  try {
    const urlObj = new URL(url);
    // Create path from URL path + filename
    const path = urlObj.pathname;

    // Check robots.txt before attempting to fetch
    const isAllowed = await checkRobotsTxt(urlObj.hostname, path);

    if (!isAllowed) {
      console.log(`Access to ${url} disallowed by robots.txt`);
      return { content: null, blockedByRobots: true };
    }

    // If allowed, proceed with fetching
    const response = await fetch(url);
    return {
      content: response.ok ? await response.text() : null,
      blockedByRobots: false,
    };
  } catch (error) {
    console.warn(`Error fetching ${url}: ${error}`);
    return { content: null, blockedByRobots: false };
  }
}

export async function fetchDocumentation({
  requestHost,
  requestUrl,
}: {
  requestHost: string;
  requestUrl?: string;
}) {
  const { subdomain, path, owner, repo } = getRepoData(requestHost, requestUrl);

  // Initialize fileUsed to prevent "used before assigned" error
  let fileUsed = "unknown";
  let content: string | null = null;
  let blockedByRobots = false;

  // Check for subdomain pattern: {subdomain}.gitmcp.io/{path}
  if (subdomain && path) {
    // Map to github.io
    const githubIoDomain = `${subdomain}.github.io`;
    const pathWithSlash = path ? `/${path}` : "";
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
  }

  // Check for github repo pattern: gitmcp.io/{owner}/{repo} or git-mcp.vercel.app/{owner}/{repo}
  else if (owner && repo) {
    // First check if we have a cached path for llms.txt
    const cachedPath = await getCachedFilePath(owner, repo, "llms.txt");
    if (cachedPath) {
      content = await fetchFileFromGitHub(
        owner,
        repo,
        cachedPath.branch,
        cachedPath.path,
      );
      if (content) {
        fileUsed = `${cachedPath.path} (${cachedPath.branch} branch, from cache)`;
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
        content = await searchGitHubRepo(owner, repo, "llms.txt");
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
        await storeDocumentationVectors(owner, repo, content, fileUsed);
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
    const mappedHost = requestHost.replace("gitmcp.io", "github.io");
    let baseURL = `https://${mappedHost}/${path}`;
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
  requestHost,
  requestUrl,
  query,
  forceReindex = false,
}: {
  requestHost: string;
  requestUrl?: string;
  query: string;
  forceReindex?: boolean;
}) {
  const hostHeader = requestHost;

  const url = new URL(requestUrl || "", `http://${hostHeader}`);
  const path = url.pathname.split("/").filter(Boolean).join("/");

  // Initialize owner and repo
  let owner: string | null = null;
  let repo: string | null = null;

  // Check for subdomain pattern: {subdomain}.gitmcp.io/{path}
  if (hostHeader.includes(".gitmcp.io")) {
    const subdomain = hostHeader.split(".")[0];
    owner = subdomain;
    repo = path || "docs";
  }
  // Check for github repo pattern: gitmcp.io/{owner}/{repo} or git-mcp.vercel.app/{owner}/{repo}
  // or git-mcp-git-{preview}-git-mcp.vercel.app/{owner}/{repo}
  else if (
    hostHeader === "gitmcp.io" ||
    hostHeader === "git-mcp.vercel.app" ||
    /^git-mcp-git-.*-git-mcp\.vercel\.app$/.test(hostHeader)
  ) {
    // Extract owner/repo from path
    [owner, repo] = path.split("/");
    if (!owner || !repo) {
      throw new Error(
        "Invalid path format for GitHub repo. Expected: {owner}/{repo}",
      );
    }
  } else {
    // For other cases, use hostname as owner and path as repo
    owner = hostHeader.replace(/\./g, "_");
    repo = path || "docs";
  }

  console.log(`Searching ${owner}/${repo}`);

  // First, check if this is the initial search for this repo/owner or if reindexing is forced
  let isFirstSearch = false;

  try {
    // Search for documentation using vector search
    let results = await searchDocumentation(owner, repo, query);

    // If no results or forceReindex is true, we need to index the documentation
    if (results.length === 0 || forceReindex) {
      console.log(
        `${
          forceReindex ? "Force reindexing" : "No search results found"
        } for in ${owner}/${repo}, fetching documentation first`,
      );
      isFirstSearch = true;

      // Fetch the documentation
      const docResult = await fetchDocumentation({ requestHost, requestUrl });
      const content = docResult.content[0].text;
      const fileUsed = docResult.fileUsed;

      console.log(
        `Fetched documentation from ${fileUsed} (${content.length} characters)`,
      );

      // Only index and search if we got actual content
      if (content && owner && repo && content !== "No documentation found.") {
        try {
          // Wait for vectors to be stored
          const vectorCount = await storeDocumentationVectors(
            owner,
            repo,
            content,
            fileUsed,
          );
          console.log(
            `Successfully indexed ${vectorCount} document chunks for ${owner}/${repo}`,
          );

          // Wait a short time to ensure indexing is complete
          await new Promise((resolve) => setTimeout(resolve, 1000));

          // Search again after indexing
          results = await searchDocumentation(owner, repo, query);
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
                    `We've just indexed the documentation for this repository (${vectorCount} chunks). ` +
                    `Your search didn't match any sections.\n\n` +
                    `Please try your search again in a moment, or try different search terms.`,
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
 * Format search results into a readable text format
 * Ensures each documentation entry is properly separated
 * @param results - Array of search results
 * @param query - The original search query
 * @returns Formatted text with search results
 */
function formatSearchResults(
  results: Array<{ chunk: string; score: number }>,
  query: string,
): string {
  let output = `### Search Results for: "${query}"\n\n`;

  if (results.length === 0) {
    return output + "No results found.";
  }

  // Array to keep track of already displayed entries to avoid duplicates
  const displayedEntries = new Set<string>();
  let resultCount = 0;

  results.forEach((result, index) => {
    // Check if this chunk contains multiple documentation entries
    // Documentation entries typically follow the pattern [Title](URL): Description
    const entryPattern = /\[.*?\]\(.*?\):\s*.*?(?=\n\n\[|$)/gs;
    const entries = result.chunk.match(entryPattern);

    if (entries && entries.length > 1) {
      // This chunk contains multiple entries, display each one separately
      entries.forEach((entry, entryIndex) => {
        // Skip duplicate entries
        const normalizedEntry = entry.trim();
        if (displayedEntries.has(normalizedEntry)) {
          return;
        }

        resultCount++;
        displayedEntries.add(normalizedEntry);

        // Add header context if available
        let headerContext = "";
        const headerMatch = result.chunk.match(/^(#+\s+.*?)(?=\n\n)/);
        if (headerMatch) {
          headerContext = headerMatch[1] + "\n\n";
        }

        output += `#### Result ${resultCount} (Score: ${result.score.toFixed(
          2,
        )})\n\n${headerContext}${normalizedEntry}\n\n`;

        // Add separator if not the last entry
        if (index < results.length - 1 || entryIndex < entries.length - 1) {
          output += "---\n\n";
        }
      });
    } else {
      // Single entry or non-standard format, display the whole chunk
      resultCount++;

      // Normalize the chunk to avoid duplicates
      const normalizedChunk = result.chunk.trim();
      if (displayedEntries.has(normalizedChunk)) {
        return;
      }

      displayedEntries.add(normalizedChunk);

      output += `#### Result ${resultCount} (Score: ${result.score.toFixed(
        2,
      )})\n\n${normalizedChunk}\n\n`;

      // Add separator if not the last result
      if (index < results.length - 1) {
        output += "---\n\n";
      }
    }
  });

  return output;
}

// Helper: fetch a file from a URL.
async function fetchFile(url: string): Promise<string | null> {
  try {
    const response = await fetch(url);
    return response.ok ? await response.text() : null;
  } catch {
    return null;
  }
}

/**
 * Fetch file content from a specific path in a GitHub repository
 * @param owner - Repository owner
 * @param repo - Repository name
 * @param branch - Branch name (main, master)
 * @param path - File path within the repository
 * @returns File content or null if not found
 */
async function fetchFileFromGitHub(
  owner: string,
  repo: string,
  branch: string,
  path: string,
): Promise<string | null> {
  return await fetchFile(
    `https://raw.githubusercontent.com/${owner}/${repo}/${branch}/${path}`,
  );
}

// Helper: search for a file in a GitHub repository using the GitHub Search API
async function searchGitHubRepo(
  owner: string,
  repo: string,
  filename: string,
): Promise<string | null> {
  try {
    const searchUrl = `https://api.github.com/search/code?q=filename:${filename}+repo:${owner}/${repo}`;

    const response = await fetch(searchUrl, {
      headers: {
        Accept: "application/vnd.github.v3+json",
        // Add GitHub token as environment variable if rate limits become an issue
        ...(process.env.GITHUB_TOKEN
          ? { Authorization: `token ${process.env.GITHUB_TOKEN}` }
          : {}),
      },
    });

    if (!response.ok) {
      console.warn(
        `GitHub API search failed: ${response.status} ${response.statusText}`,
      );
      return null;
    }

    const data = await response.json();

    // Check if we found any matches
    if (data.total_count === 0 || !data.items || data.items.length === 0) {
      return null;
    }

    // Get the first matching file's path
    const filePath = data.items[0].path;

    // Try fetching from both main and master branches in parallel
    const [mainContent, masterContent] = await Promise.all([
      fetchFileFromGitHub(owner, repo, "main", filePath),
      fetchFileFromGitHub(owner, repo, "master", filePath),
    ]);

    // Cache the successful path
    if (mainContent) {
      await cacheFilePath(owner, repo, filename, filePath, "main");
      return mainContent;
    } else if (masterContent) {
      await cacheFilePath(owner, repo, filename, filePath, "master");
      return masterContent;
    }

    return null;
  } catch (error) {
    console.error(
      `Error searching GitHub repo ${owner}/${repo} for ${filename}:`,
      error,
    );
    return null;
  }
}
