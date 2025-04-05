import { Redis } from "@upstash/redis";
import { RobotsRule } from "./robotsTxt.js";

// Initialize Upstash Redis client
const redis = Redis.fromEnv();

// Cache TTL in seconds (7 days)
const CACHE_TTL = 60 * 60 * 24 * 7;

// Cache TTL for robots.txt (1 day)
const ROBOTS_CACHE_TTL = 60 * 60 * 24;

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

/**
 * Cache key structure for robots.txt content
 * @param domain - Website domain
 * @returns Cache key
 */
export function getRobotsTxtCacheKey(domain: string): string {
  return `robotstxt:${domain}`;
}

/**
 * Get cached robots.txt rules for a domain
 * @param domain - Website domain
 * @returns Array of robot rules if found in cache, null otherwise
 */
export async function getCachedRobotsTxt(
  domain: string,
): Promise<RobotsRule[] | null> {
  try {
    const key = getRobotsTxtCacheKey(domain);
    const result = await redis.get(key);
    return (result as RobotsRule[]) || null;
  } catch (error) {
    console.warn("Failed to retrieve robots.txt from Upstash cache:", error);
    return null;
  }
}

/**
 * Cache robots.txt rules for a domain
 * @param domain - Website domain
 * @param rules - Array of robot rules to cache
 */
export async function cacheRobotsTxt(
  domain: string,
  rules: RobotsRule[],
): Promise<void> {
  try {
    const key = getRobotsTxtCacheKey(domain);
    await redis.set(key, rules, { ex: ROBOTS_CACHE_TTL });
  } catch (error) {
    console.warn("Failed to save robots.txt to Upstash cache:", error);
  }
}
