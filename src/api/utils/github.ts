import { cacheFilePath, getCachedFilePath } from "./cache.js";
import {
  searchFileByName,
  githubApiRequest,
  fetchRawFile,
} from "./githubClient.js";

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
  env: Env,
  useAuth = false,
): Promise<string | null> {
  return await fetchRawFile(owner, repo, branch, path, env, useAuth);
}

export interface GitHubFile {
  path: string;
  content: string;
}

// Helper: search for a file in a GitHub repository using the GitHub Search API
export async function searchGitHubRepo(
  owner: string,
  repo: string,
  filename: string,
  branch: string,
  env: Env,
  ctx: ExecutionContext,
): Promise<GitHubFile | null> {
  try {
    const cachedFile = await getCachedFilePath(owner, repo, env);
    let filePath = cachedFile?.path || "";

    if (!filePath) {
      // Use the centralized GitHub client to search for the file
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
      filePath = data.items[0]?.path;
    }

    const content = await fetchFileFromGitHub(
      owner,
      repo,
      branch,
      filePath,
      env,
    );

    if (content) {
      ctx.waitUntil(
        cacheFilePath(owner, repo, filename, filePath, branch, env),
      );
      return { content, path: filePath };
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

export function constructGithubUrl(
  owner: string,
  repo: string,
  branch: string,
  path: string,
) {
  return `https://raw.githubusercontent.com/${owner}/${repo}/${branch}/${path}`;
}

/**
 * Determines the default branch of a GitHub repository.
 * First tries to get the actual default branch using GitHub API,
 * then falls back to checking if 'main' or 'master' branches exist.
 *
 * @param owner - Repository owner or organization
 * @param repo - Repository name
 * @param env - Environment with API tokens and cache configuration
 * @returns The default branch name
 * @throws Error if the default branch cannot be determined
 */
export async function getRepoBranch(
  owner: string,
  repo: string,
  env: CloudflareEnvironment,
): Promise<string> {
  try {
    // First try to get the actual default branch using GitHub API
    const apiUrl = `https://api.github.com/repos/${owner}/${repo}`;
    const response = await githubApiRequest(apiUrl, {}, env);

    if (response && response.ok) {
      const data = (await response.json()) as { default_branch?: string };
      if (data && data.default_branch) {
        console.log("Default branch found", data.default_branch);
        return data.default_branch;
      }
    }

    console.error(
      "No default branch found, falling back to main/master check",
      response,
    );

    // Fall back to the main/master check if API request fails
    // Try 'main' branch
    const mainUrl = constructGithubUrl(owner, repo, "main", "README.md");
    const mainResponse = await githubApiRequest(
      mainUrl,
      { method: "HEAD" },
      env,
    );

    if (mainResponse && mainResponse.ok) {
      return "main";
    }

    // If 'main' branch doesn't exist, try 'master'
    const masterUrl = constructGithubUrl(owner, repo, "master", "README.md");
    const masterResponse = await githubApiRequest(
      masterUrl,
      { method: "HEAD" },
      env,
    );

    if (masterResponse && masterResponse.ok) {
      return "master";
    }

    // If neither branch exists, throw an error
    throw new Error(
      `Could not determine default branch for ${owner}/${repo}. Neither 'main' nor 'master' branches found.`,
    );
  } catch (error) {
    console.error(
      `Error determining default branch for ${owner}/${repo}:`,
      error,
    );
    // Default to 'main' in case of network errors or other issues
    // This is a fallback to maintain compatibility with existing code
    return "main";
  }
}
