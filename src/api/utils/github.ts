import { fetchFile } from "./helpers.js";
import { cacheFilePath, getCachedFilePath } from "./cache.js";

/**
 * Fetch file content from a specific path in a GitHub repository
 * @param owner - Repository owner
 * @param repo - Repository name
 * @param branch - Branch name (main, master)
 * @param path - File path within the repository
 * @returns File content or null if not found
 */
export async function fetchFileFromGitHub(
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
export async function searchGitHubRepo(
  owner: string,
  repo: string,
  filename: string,
  env?: any,
): Promise<string | null> {
  try {
    // First check if we have a cached path for this file
    const cachedPath = await getCachedFilePath(owner, repo, filename, env);
    if (cachedPath) {
      console.log(`Using cached path for ${filename} in ${owner}/${repo}`);
      const content = await fetchFileFromGitHub(
        owner,
        repo,
        cachedPath.branch,
        cachedPath.path,
      );
      if (content) {
        return content;
      }
      console.log("Cached path failed, falling back to search");
    }

    const searchUrl = `https://api.github.com/search/code?q=filename:${filename}+repo:${owner}/${repo}`;

    const response = await fetch(searchUrl, {
      headers: {
        Accept: "application/vnd.github.v3+json",
        // Add GitHub token as environment variable if rate limits become an issue
        ...(process?.env?.GITHUB_TOKEN
          ? { Authorization: `token ${process?.env?.GITHUB_TOKEN}` }
          : {}),
      },
    });

    if (!response.ok) {
      console.warn(
        `GitHub API search failed: ${response.status} ${response.statusText}`,
      );
      return null;
    }

    const data = (await response.json()) as {
      total_count: number;
      items: { path: string }[];
    };

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
      await cacheFilePath(owner, repo, filename, filePath, "main", env);
      return mainContent;
    } else if (masterContent) {
      await cacheFilePath(owner, repo, filename, filePath, "master", env);
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
