import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { getCachedFilePath, cacheFilePath } from "../utils/upstash.js";

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
    // First check the cache
    const cachedPath = await getCachedFilePath(owner, repo, filename);
    if (cachedPath) {
      const content = await fetchFileFromGitHub(
        owner,
        repo,
        cachedPath.branch,
        cachedPath.path,
      );
      if (content) {
        console.log(`Cache hit for ${filename} in ${owner}/${repo}`);
        return content;
      } else {
        console.log(
          `Cache hit but file not found anymore for ${filename} in ${owner}/${repo}`,
        );
      }
    }

    // If not in cache or cached path didn't work, use GitHub Search API
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

export function registerTools(
  mcp: McpServer,
  requestHost: string,
  requestUrl?: string,
) {
  // Generate a dynamic description based on the URL
  const description = generateToolDescription(requestHost, requestUrl);
  const toolName = generateToolName(requestHost, requestUrl);

  mcp.tool(toolName, description, {}, async () =>
    fetchDocumentation({ requestHost, requestUrl }),
  );
}

export function registerStdioTools(mcp: McpServer) {
  mcp.tool(
    "fetch_documentation",
    "Fetch documentation for a repository (URL will be provided when called).",
    {
      requestUrl: z.string(),
    },
    async ({ requestUrl }) => {
      const requestHost = new URL(requestUrl).host;
      // Generate dynamic description after the URL is provided
      const description = generateToolDescription(requestHost, requestUrl);
      console.log(`Using tool description: ${description}`);
      return fetchDocumentation({
        requestHost,
        requestUrl,
      });
    },
  );
}

/**
 * Generate a dynamic description for the fetch_documentation tool based on the URL
 * @param requestHost - The host from the request
 * @param requestUrl - The full request URL (optional)
 * @returns A descriptive string for the tool
 */
function generateToolDescription(
  requestHost: string,
  requestUrl?: string,
): string {
  try {
    console.log("Generating tool description for host:", requestUrl);

    // Default description as fallback
    let description = "Fetch documentation for the current repository.";

    // Parse the URL if provided
    const url = requestUrl
      ? new URL(`http://${requestHost}${requestUrl}`)
      : new URL(`http://${requestHost}`);
    const path = url.pathname.split("/").filter(Boolean).join("/");

    // Check for subdomain pattern: {subdomain}.gitmcp.io/{path}
    if (requestHost.includes(".gitmcp.io")) {
      const subdomain = requestHost.split(".")[0];
      description = `Fetch documentation from the ${subdomain}/${path} GitHub Pages.`;
    }
    // Check for github repo pattern: gitmcp.io/{owner}/{repo} or git-mcp.vercel.app/{owner}/{repo}
    else if (
      requestHost === "gitmcp.io" ||
      requestHost === "git-mcp.vercel.app"
    ) {
      // Extract owner/repo from path
      const [owner, repo] = path.split("/");
      if (owner && repo) {
        description = `Fetch documentation from GitHub repository: ${owner}/${repo}.`;
      }
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
function generateToolName(requestHost: string, requestUrl?: string): string {
  try {
    console.log("Generating tool name for host:", requestUrl);

    // Default description as fallback
    let toolName = "fetch_documentation";

    // Parse the URL if provided
    const url = requestUrl
      ? new URL(requestUrl)
      : new URL(`http://${requestHost}`);
    const path = url.pathname.split("/").filter(Boolean).join("/");

    // Check for subdomain pattern: {subdomain}.gitmcp.io/{path}
    if (requestHost.includes(".gitmcp.io")) {
      const subdomain = requestHost.split(".")[0];
      toolName = `fetch_${subdomain}_documentation`;
    }
    // Check for github repo pattern: gitmcp.io/{owner}/{repo} or git-mcp.vercel.app/{owner}/{repo}
    else if (
      requestHost === "gitmcp.io" ||
      requestHost === "git-mcp.vercel.app"
    ) {
      // Extract owner/repo from path
      const [owner, repo] = path.split("/");
      if (owner && repo) {
        toolName = `fetch_${owner}_${repo}_documentation`;
      }
    }

    return toolName;
  } catch (error) {
    // Return default tool name if there's any error parsing the URL
    return "fetch_documentation";
  }
}

async function fetchDocumentation({
  requestHost,
  requestUrl,
}: {
  requestHost: string;
  requestUrl?: string;
}) {
  const hostHeader = requestHost;

  const url = new URL(requestUrl || "", `http://${hostHeader}`);
  const path = url.pathname.split("/").filter(Boolean).join("/");

  // Initialize fileUsed to prevent "used before assigned" error
  let fileUsed = "unknown";
  let content: string | null = null;

  // Check for subdomain pattern: {subdomain}.gitmcp.io/{path}
  if (hostHeader.includes(".gitmcp.io")) {
    const subdomain = hostHeader.split(".")[0];
    // Map to github.io
    const baseURL = `https://${subdomain}.github.io/${path}/`;
    content = await fetchFile(baseURL + "llms.txt");
    fileUsed = "llms.txt";
  }
  // Check for github repo pattern: gitmcp.io/{owner}/{repo} or git-mcp.vercel.app/{owner}/{repo}
  else if (hostHeader === "gitmcp.io" || hostHeader === "git-mcp.vercel.app") {
    // Extract owner/repo from path
    const [owner, repo] = path.split("/");
    if (!owner || !repo) {
      throw new Error(
        "Invalid path format for GitHub repo. Expected: {owner}/{repo}",
      );
    }

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
      // Try static paths for llms.txt
      const possibleLocations = [
        "docs/docs/llms.txt", // Current default
        "llms.txt", // Root directory
        "docs/llms.txt", // Common docs folder
        "documentation/llms.txt", // Alternative docs folder
      ];

      // Try each location on 'main' branch first, then 'master' branch
      for (const location of possibleLocations) {
        // Try main branch
        content = await fetchFileFromGitHub(owner, repo, "main", location);

        if (content) {
          fileUsed = `${location} (main branch)`;
          // Cache the successful path
          await cacheFilePath(owner, repo, "llms.txt", location, "main");
          break;
        }

        // Try master branch
        content = await fetchFileFromGitHub(owner, repo, "master", location);

        if (content) {
          fileUsed = `${location} (master branch)`;
          // Cache the successful path
          await cacheFilePath(owner, repo, "llms.txt", location, "master");
          break;
        }
      }

      // Fallback to GitHub Search API if static paths don't work for llms.txt
      if (!content) {
        content = await searchGitHubRepo(owner, repo, "llms.txt");
        if (content) {
          fileUsed = "llms.txt (found via GitHub Search API)";
        }
      }
    }

    // Fallback to README.md if llms.txt not found in any location
    if (!content) {
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
  }
  // Default/fallback case
  else {
    // Map "gitmcp.io" to "github.io"
    const mappedHost = hostHeader.replace("gitmcp.io", "github.io");
    let baseURL = `https://${mappedHost}/${path}`;
    if (!baseURL.endsWith("/")) {
      baseURL += "/";
    }
    content = await fetchFile(baseURL + "llms.txt");
    fileUsed = "llms.txt";

    if (!content) {
      content = await fetchFile(baseURL + "readme.md");
      fileUsed = "readme.md";
    }
  }

  if (!content) {
    content = "No documentation found. Generated fallback content.";
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
