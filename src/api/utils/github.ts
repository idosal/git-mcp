import { cacheFilePath } from "./cache.js";
import { fetchRawFile } from "./githubClient.js";
import { searchFileByName } from "./githubClient.js";

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

export interface GitHubFile {
  path: string;
  content: string;
}

// Helper: search for a file in a GitHub repository using the GitHub Search API
export async function searchGitHubRepo(
  owner: string,
  repo: string,
  filename: string,
  env: any,
): Promise<GitHubFile | null> {
  try {
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
    const filePath = data.items[0].path;

    // Try fetching from both main and master branches in parallel
    const [mainContent, masterContent] = await Promise.all([
      fetchFileFromGitHub(owner, repo, "main", filePath, env),
      fetchFileFromGitHub(owner, repo, "master", filePath, env),
    ]);

    // Cache the successful path
    if (mainContent) {
      await cacheFilePath(owner, repo, filename, filePath, "main", env);
      return { content: mainContent, path: filePath };
    } else if (masterContent) {
      await cacheFilePath(owner, repo, filename, filePath, "master", env);
      return { content: masterContent, path: filePath };
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
 * Determines whether a GitHub repository uses 'main' or 'master' as its default branch.
 * First tries to access the repository with 'main', then falls back to 'master' if that fails.
 *
 * @param owner - Repository owner or organization
 * @param repo - Repository name
 * @returns The default branch name ('main' or 'master')
 * @throws Error if neither 'main' nor 'master' branches are found
 */
export async function getRepoBranch(
  owner: string,
  repo: string,
): Promise<string> {
  try {
    // First try to access the repository with 'main' branch
    const mainUrl = `https://github.com/${owner}/${repo}/tree/main/`;
    const mainResponse = await fetch(mainUrl, { method: "HEAD" });

    if (mainResponse.ok) {
      return "main";
    }

    // If 'main' branch doesn't exist, try 'master'
    const masterUrl = `https://github.com/${owner}/${repo}/tree/master/`;
    const masterResponse = await fetch(masterUrl, { method: "HEAD" });

    if (masterResponse.ok) {
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
