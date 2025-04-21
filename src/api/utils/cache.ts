import type { RobotsRule } from "./robotsTxt.js";
import type { FetchDocumentationResult } from "../tools/commonTools.js";

// Define the format options and their corresponding return types
export type FormatOptions = {
  text: string;
  json: Record<string, unknown>;
};

// 12 hour TTL in seconds with jitter (base time ±20%)
const BASE_TTL = 60 * 60 * 12; // 12 hours in seconds
const JITTER_FACTOR = 0.2; // 20% jitter

// Cache TTL in seconds (12 hours with jitter)
function getCacheTTL(): number {
  const jitterAmount = BASE_TTL * JITTER_FACTOR;
  const jitter = Math.random() * (jitterAmount * 2) - jitterAmount; // Random value between -jitterAmount and +jitterAmount
  return Math.floor(BASE_TTL + jitter);
}

/**
 * Cache key structure for repository file paths
 * @param owner - Repository owner
 * @param repo - Repository name
 * @returns Cache key
 */
export function getRepoFilePathCacheKey(owner: string, repo: string): string {
  return `repo:${owner}:${repo}`;
}

/**
 * Cache key structure for vector existence
 * @param owner - Repository owner
 * @param repo - Repository name
 * @returns Cache key
 */
export function getIsIndexedCacheKey(owner: string, repo: string): string {
  return `vector_exists:${owner}:${repo}`;
}

/**
 * Cache key structure for fetchDocumentation results
 * @param owner - Repository owner
 * @param repo - Repository name
 * @returns Cache key
 */
export function getFetchDocCacheKey(owner: string, repo: string): string {
  return `fetch_doc:${owner}:${repo}`;
}

/**
 * Cache key structure for URL content
 * @param url - The URL being cached
 * @param format - The format of the content (json, text)
 * @returns Cache key
 */
export function getUrlContentCacheKey(url: string, format: string): string {
  return `url_content:${format}:${url}`;
}

/**
 * Get a value from KV cache
 * @param key - The cache key
 * @param env - Environment with Cloudflare bindings
 * @returns The cached value or null if not found
 */
async function getFromCache(key: string, env: Env): Promise<any> {
  // Check KV store for cached value
  if (env?.CACHE_KV) {
    try {
      const result = await env.CACHE_KV.get(key, { type: "json" });
      console.log(`Cache retrieval for key ${key}:`, result);
      return result;
    } catch (error) {
      console.warn("Failed to retrieve from Cloudflare KV:", error);
    }
  }

  return null;
}

/**
 * Store a value in KV cache
 * @param key - The cache key
 * @param value - The value to cache
 * @param ttl - Time to live in seconds (optional, defaults to 12 hours with jitter)
 * @param env - Environment with Cloudflare bindings
 */
async function setInCache(
  key: string,
  value: any,
  env: Env,
  ttl?: number,
): Promise<void> {
  // Use provided TTL or generate one with jitter
  const cacheTTL = ttl || getCacheTTL();

  // Store in KV cache
  if (env?.CACHE_KV) {
    try {
      await env.CACHE_KV.put(key, JSON.stringify(value), {
        expirationTtl: cacheTTL,
      });
    } catch (error) {
      console.warn("Failed to save to Cloudflare KV:", error);
    }
  }
}

/**
 * Get cached file path for a repository file
 * @param owner - Repository owner
 * @param repo - Repository name
 * @param filename - File name
 * @param env - Environment with Cloudflare bindings
 * @returns Object with path and branch if found in cache, null otherwise
 */
export async function getCachedFilePath(
  owner: string,
  repo: string,
  env: Env,
): Promise<{ path: string; branch: string } | null> {
  try {
    const key = getRepoFilePathCacheKey(owner, repo);
    const result = await getFromCache(key, env);
    return result as { path: string; branch: string } | null;
  } catch (error) {
    console.warn("Failed to retrieve from cache:", error);
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
 * @param env - Environment with Cloudflare bindings
 */
export async function cacheFilePath(
  owner: string,
  repo: string,
  filename: string,
  path: string,
  branch: string,
  env: Env,
): Promise<void> {
  try {
    const key = getRepoFilePathCacheKey(owner, repo);
    await setInCache(key, { path, branch }, env, getCacheTTL());
    console.log(
      `Cached file path for ${filename} in ${owner}/${repo}: ${path}`,
    );
  } catch (error) {
    console.warn("Failed to save to cache:", error);
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
 * @param env - Environment with Cloudflare bindings
 * @returns Array of robot rules if found in cache, null otherwise
 */
export async function getCachedRobotsTxt(
  domain: string,
  env: Env,
): Promise<RobotsRule[] | null> {
  try {
    const key = getRobotsTxtCacheKey(domain);
    const result = await getFromCache(key, env);
    return result as RobotsRule[] | null;
  } catch (error) {
    console.warn("Failed to retrieve robots.txt from cache:", error);
    return null;
  }
}

/**
 * Cache robots.txt rules for a domain
 * @param domain - Website domain
 * @param rules - Array of robot rules to cache
 * @param env - Environment with Cloudflare bindings
 */
export async function cacheRobotsTxt(
  domain: string,
  rules: RobotsRule[],
  env: Env,
): Promise<void> {
  try {
    const key = getRobotsTxtCacheKey(domain);
    await setInCache(key, rules, env, getCacheTTL());
  } catch (error) {
    console.warn("Failed to save robots.txt to cache:", error);
  }
}

/**
 * Check if vectors exist in cache for a repository
 * @param owner - Repository owner
 * @param repo - Repository name
 * @param env - Environment with Cloudflare bindings
 * @returns Boolean indicating if vectors exist, or null if not in cache
 */
export async function getIsIndexedFromCache(
  owner: string,
  repo: string,
  env: Env,
): Promise<boolean | null> {
  try {
    const key = getIsIndexedCacheKey(owner, repo);
    const result = await getFromCache(key, env);
    return result as boolean | null;
  } catch (error) {
    console.warn("Failed to retrieve vector existence from cache:", error);
    return null;
  }
}

/**
 * Cache whether vectors exist for a repository
 * @param owner - Repository owner
 * @param repo - Repository name
 * @param exists - Boolean indicating if vectors exist
 * @param env - Environment with Cloudflare bindings
 */
export async function cacheIsIndexed(
  owner: string,
  repo: string,
  exists: boolean,
  env: Env,
): Promise<void> {
  try {
    const key = getIsIndexedCacheKey(owner, repo);
    await setInCache(key, exists, env, getCacheTTL());
    console.log(`Cached vector existence for ${owner}/${repo}: ${exists}`);
  } catch (error) {
    console.warn("Failed to save vector existence to cache:", error);
  }
}

/**
 * Fetch URL content with Cloudflare's tiered cache
 * @param url - URL to fetch
 * @param format - Format of the content (json, text)
 * @returns Content from the URL or null on error
 */
export async function fetchUrlContent<T extends keyof FormatOptions>({
  url,
  format,
}: {
  url: string;
  format: T;
}): Promise<FormatOptions[T] | null> {
  try {
    console.log(`Fetching ${url} with Cloudflare tiered cache`);

    const cfCacheOptions = {
      cacheEverything: true,
      cacheTtlByStatus: {
        "200-299": 3600, // Cache successful responses for 1 hour
        "404": 60, // Cache "Not Found" responses for 60 seconds
        "500-599": 0, // Do not cache server error responses
      },
    };

    // Use Cloudflare's tiered cache for content requests
    const response = await fetch(url, {
      cf: cfCacheOptions,
    });

    // Don't proceed with unsuccessful responses
    if (!response.ok) {
      console.log(
        `Error fetching ${url}: ${response.status} ${response.statusText}`,
      );
      return null;
    }

    // Process the response based on requested format
    const result =
      format === "json" ? await response.json() : await response.text();
    return result as FormatOptions[T];
  } catch (error) {
    console.warn(`Failed to fetch URL content (${url}):`, error);
    return null;
  }
}

/**
 * Get cached fetchDocumentation result
 * @param owner - Repository owner
 * @param repo - Repository name
 * @param env - Environment with Cloudflare bindings
 * @returns The cached FetchDocumentationResult or null if not found
 */
export async function getCachedFetchDocResult(
  owner: string,
  repo: string,
  env: Env,
): Promise<FetchDocumentationResult | null> {
  try {
    const key = getFetchDocCacheKey(owner, repo);
    const result = await getFromCache(key, env);
    return result as FetchDocumentationResult | null;
  } catch (error) {
    console.warn("Failed to retrieve fetchDoc result from cache:", error);
    return null;
  }
}

/**
 * Cache fetchDocumentation result
 * @param owner - Repository owner
 * @param repo - Repository name
 * @param result - The FetchDocumentationResult to cache
 * @param ttl - Time to live in seconds
 * @param env - Environment with Cloudflare bindings
 */
export async function cacheFetchDocResult(
  owner: string,
  repo: string,
  result: FetchDocumentationResult,
  ttl: number,
  env: Env,
): Promise<void> {
  try {
    const key = getFetchDocCacheKey(owner, repo);
    await setInCache(key, result, env, ttl);
    console.log(
      `Cached fetchDocumentation result for ${owner}/${repo} with TTL ${ttl}s`,
    );
  } catch (error) {
    console.warn("Failed to save fetchDoc result to cache:", error);
  }
}
