import { Redis } from "@upstash/redis";

// Initialize Upstash Redis client
const redis = Redis.fromEnv();

// Cache TTL in seconds (7 days)
const CACHE_TTL = 60 * 60 * 24 * 7;

/**
 * Cache key structure for repository file paths
 * @param owner - Repository owner
 * @param repo - Repository name
 * @param filename - File name to cache path for
 * @returns Cache key
 */
export function getRepoFilePathCacheKey(
  owner: string,
  repo: string,
  filename: string,
): string {
  return `repo:${owner}:${repo}:filepath:${filename}`;
}

/**
 * Get cached file path for a repository file
 * @param owner - Repository owner
 * @param repo - Repository name
 * @param filename - File name
 * @returns Object with path and branch if found in cache, null otherwise
 */
export async function getCachedFilePath(
  owner: string,
  repo: string,
  filename: string,
): Promise<{ path: string; branch: string } | null> {
  try {
    const key = getRepoFilePathCacheKey(owner, repo, filename);
    const result = await redis.get(key);
    return (result as { path: string; branch: string }) || null;
  } catch (error) {
    console.warn("Failed to retrieve from Upstash cache:", error);
    return null;
  }
}

/**
 * Cache a file path for a repository file
 * @param owner - Repository owner
 * @param repo - Repository name
 * @param filename - File name
 * @param path - File path within the repository
 * @param branch - Branch name (main, master, etc.)
 */
export async function cacheFilePath(
  owner: string,
  repo: string,
  filename: string,
  path: string,
  branch: string,
): Promise<void> {
  try {
    const key = getRepoFilePathCacheKey(owner, repo, filename);
    await redis.set(key, { path, branch }, { ex: CACHE_TTL });
  } catch (error) {
    console.warn("Failed to save to Upstash cache:", error);
  }
}
