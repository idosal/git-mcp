import { fetchFile } from "./helpers.js";
import { cacheFilePath, getCachedFilePath } from "./cache.js";
import { fetchRawFile } from "./githubClient.js";

/**
 * Fetch file content from a specific path in a GitHub repository
 * @param owner - Repository owner
 * @param repo - Repository name
 * @param branch - Branch name (main, master)
 * @param path - File path within the repository
 * @param env - Environment for GitHub token
 * @param useAuth - Whether to use authentication
 * @returns File content or null if not found
 */
export async function fetchFileFromGitHub(
  owner: string,
  repo: string,
  branch: string,
  path: string,
  env: any,
  useAuth = false,
): Promise<string | null> {
  return await fetchRawFile(owner, repo, branch, path, env, useAuth);
}

// Helper: search for a file in a GitHub repository using the GitHub Search API
export async function searchGitHubRepo(
  owner: string,
  repo: string,
  filename: string,
  env: any,
): Promise<string | null> {
  try {
    // First check if we have a cached path for this file
    const cachedPath = await getCachedFilePath(owner, repo, env);
    if (cachedPath) {
      console.log(`Using cached path for ${filename} in ${owner}/${repo}`);
      const content = await fetchFileFromGitHub(
        owner,
        repo,
        cachedPath.branch,
        cachedPath.path,
        env,
        true,
      );
      if (content) {
        return content;
      }
      console.log("Cached path failed, falling back to search");
    }

    // Use the centralized GitHub client to search for the file
    const { searchFileByName } = await import("./githubClient.js");
    const data = await searchFileByName(filename, owner, repo, env);

    // Handle search failure
    if (!data) {
      return null;
    }

    // Check if we found any matches
    if (data.total_count === 0 || !data.items || data.items.length === 0) {
      return null;
    }

    // Get the first matching file's path
    const filePath = data.items[0].path;

    // Try fetching from both main and master branches in parallel
    const [mainContent, masterContent] = await Promise.all([
      fetchFileFromGitHub(owner, repo, "main", filePath, env),
      fetchFileFromGitHub(owner, repo, "master", filePath, env),
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
