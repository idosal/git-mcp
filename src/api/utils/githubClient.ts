/**
 * GitHub API client with rate limiting support
 * This file contains utilities for making GitHub API requests with proper rate limiting handling
 */

import { constructGithubUrl } from "./github";

// Default time between API requests in ms (to avoid hitting rate limits)
const DEFAULT_DELAY = 1000;
// Default number of retries for rate-limited requests
const MAX_RETRIES = 3;

/**
 * Extract repository context from a GitHub URL
 * This helps provide context for analytics metrics
 */
function extractRepoContextFromUrl(url: string): string {
  try {
    // Handle raw.githubusercontent.com URLs
    if (url.includes("raw.githubusercontent.com")) {
      const match = url.match(
        /raw\.githubusercontent\.com\/([^\/]+)\/([^\/]+)/,
      );
      if (match) {
        return `${match[1]}/${match[2]}`;
      }
    }

    // Handle api.github.com/repos URLs
    if (url.includes("api.github.com/repos")) {
      const match = url.match(/api\.github\.com\/repos\/([^\/]+)\/([^\/]+)/);
      if (match) {
        return `${match[1]}/${match[2]}`;
      }
    }

    // Handle api.github.com/search URLs with repo: parameter
    if (url.includes("api.github.com/search")) {
      const repoMatch = url.match(/repo:([^\/+\s]+)\/([^\/+\s]+)/);
      if (repoMatch) {
        return `${repoMatch[1]}/${repoMatch[2]}`;
      }
    }

    return "unknown/unknown";
  } catch (error) {
    console.error(`Error extracting repo context from URL: ${error}`);
    return "error/extracting";
  }
}

/**
 * Rate limiting state tracking
 */
interface RateLimitInfo {
  remaining: number;
  resetTime: Date | null;
  limit: number;
}

// Store rate limit information
let apiRateLimit: RateLimitInfo = {
  remaining: 5000, // GitHub API default for unauthenticated requests
  resetTime: null,
  limit: 5000,
};

/**
 * Update rate limit information from GitHub API response headers
 */
function updateRateLimitFromHeaders(headers: Headers): void {
  const remaining = headers.get("x-ratelimit-remaining");
  const resetTime = headers.get("x-ratelimit-reset");
  const limit = headers.get("x-ratelimit-limit");

  if (remaining) {
    apiRateLimit.remaining = parseInt(remaining, 10);
  }

  if (resetTime) {
    apiRateLimit.resetTime = new Date(parseInt(resetTime, 10) * 1000);
  }

  if (limit) {
    apiRateLimit.limit = parseInt(limit, 10);
  }

  console.log(
    `GitHub API rate limit: ${apiRateLimit.remaining}/${apiRateLimit.limit} remaining, resets at ${apiRateLimit.resetTime}`,
  );
}

/**
 * Delay execution to respect rate limits
 */
async function respectRateLimits(): Promise<void> {
  // If we have very few requests remaining, add delay
  if (apiRateLimit.remaining < 5 && apiRateLimit.resetTime) {
    const timeUntilReset = apiRateLimit.resetTime.getTime() - Date.now();

    // If reset time is in the future, delay until reset
    if (timeUntilReset > 0) {
      console.log(
        `Rate limit low (${apiRateLimit.remaining} remaining). Waiting ${timeUntilReset}ms until reset`,
      );
      await new Promise((resolve) =>
        setTimeout(resolve, Math.min(timeUntilReset + 1000, 60000)),
      ); // Max 1 minute wait
    }
  } else {
    // Add a small delay between requests to avoid hitting rate limits
    await new Promise((resolve) => setTimeout(resolve, DEFAULT_DELAY));
  }
}

/**
 * Make a GitHub API request with rate limit handling
 * @param url - API URL to fetch
 * @param options - Fetch options
 * @param env - Environment containing GitHub token if available
 * @param retryCount - Current retry attempt (used internally)
 * @param useAuth - Whether to include authorization header if token is available (default: true)
 * @returns The API response or null if failed
 */
export async function githubApiRequest(
  url: string,
  options: RequestInit = {},
  env: CloudflareEnvironment,
  retryCount = 1,
  useAuth = true,
): Promise<Response | null> {
  try {
    // Extract repository context for metrics
    const repoContext = extractRepoContextFromUrl(url);

    // Track GitHub query count using Cloudflare analytics
    if (env?.CLOUDFLARE_ANALYTICS && retryCount === 0) {
      env.CLOUDFLARE_ANALYTICS.writeDataPoint({
        blobs: [url, repoContext],
        doubles: [1],
        indexes: ["github_api_request"],
      });
    }

    // Wait for rate limit if necessary
    await respectRateLimits();

    // Add GitHub authentication if token is available and useAuth is true
    const headers = new Headers(options.headers || {});
    headers.set("Accept", "application/vnd.github.v3+json");
    headers.set(
      "User-Agent",
      "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/135.0.0.0 Safari/537.36",
    );

    if (useAuth && env.GITHUB_TOKEN) {
      headers.set("Authorization", `token ${env.GITHUB_TOKEN}`);
    }

    // Configure Cloudflare's tiered cache
    const cfCacheOptions = {
      cacheEverything: true,
      cacheTtlByStatus: {
        "200-299": 3600, // Cache successful responses for 1 hour
        "404": 60, // Cache "Not Found" responses for 60 seconds
        "500-599": 0, // Do not cache server error responses
      },
    };

    // Make the request with tiered cache
    const response = await fetch(url, {
      ...options,
      headers,
      credentials: "omit", // Avoid CORS issues
      cf: cfCacheOptions, // Use Cloudflare's tiered cache
    });

    // Update rate limit info from response headers
    updateRateLimitFromHeaders(response.headers);

    // Handle rate limiting (status 403 with specific message)
    if (response.status === 403) {
      const responseBody = await response.text();

      if (responseBody.includes("API rate limit exceeded")) {
        console.warn(`GitHub API rate limit exceeded`);

        // Track rate-limited requests with repository context using Cloudflare analytics
        if (env?.CLOUDFLARE_ANALYTICS) {
          const repoContext = extractRepoContextFromUrl(url);
          env.CLOUDFLARE_ANALYTICS.writeDataPoint({
            blobs: [url, repoContext, responseBody.substring(0, 100)], // First 100 chars of error message
            doubles: [1, retryCount],
            indexes: ["github_rate_limited_request"],
          });
        }

        // If we haven't retried too many times, wait and retry
        if (retryCount < MAX_RETRIES) {
          // Calculate wait time (default: wait 60 seconds for rate limits to refresh)
          const waitTime = apiRateLimit.resetTime
            ? Math.max(
                1000,
                apiRateLimit.resetTime.getTime() - Date.now() + 1000,
              )
            : 60000;

          console.log(
            `Rate limited. Waiting ${waitTime}ms before retry ${retryCount + 1}/${MAX_RETRIES}`,
          );
          await new Promise((resolve) => setTimeout(resolve, waitTime));

          // Retry the request
          return githubApiRequest(url, options, env, retryCount + 1);
        }
      }
    }

    return response;
  } catch (error) {
    console.error(`GitHub API request to ${url} failed: ${error}`);

    // Retry on network errors
    if (retryCount < MAX_RETRIES) {
      console.log(
        `Network error. Retrying ${retryCount + 1}/${MAX_RETRIES}...`,
      );
      await new Promise((resolve) => setTimeout(resolve, 2000)); // Wait 2 seconds
      return githubApiRequest(url, options, env, retryCount + 1);
    }

    return null;
  }
}

/**
 * Search for code in a GitHub repository
 * @param query - Search query
 * @param owner - Repository owner
 * @param repo - Repository name
 * @param env - Environment for GitHub token
 * @param page - Page number (1-indexed)
 * @param perPage - Results per page (max 100)
 */
export async function searchCode(
  query: string,
  owner: string,
  repo: string,
  env: Env,
  page: number = 1,
  perPage: number = 20,
): Promise<any> {
  // GitHub API has a max per_page of 100
  const validPerPage = Math.min(Math.max(1, perPage), 100);

  const searchUrl = `https://api.github.com/search/code?q=${encodeURIComponent(query)}+repo:${owner}/${repo}&page=${page}&per_page=${validPerPage}`;

  const response = await githubApiRequest(searchUrl, {}, env);

  if (!response || !response.ok) {
    console.warn(
      `GitHub API code search failed: ${response?.status} ${response?.statusText}`,
    );
    return null;
  }

  return response.json();
}

/**
 * Search for a specific filename in a GitHub repository
 * @param filename - Filename to search for
 * @param owner - Repository owner
 * @param repo - Repository name
 * @param env - Environment for GitHub token
 */
export async function searchFileByName(
  filename: string,
  owner: string,
  repo: string,
  env: Env,
): Promise<any> {
  const searchUrl = `https://api.github.com/search/code?q=filename:${filename}+repo:${owner}/${repo}`;
  const response = await githubApiRequest(searchUrl, {}, env);

  if (!response || !response.ok) {
    console.warn(
      `GitHub API filename search failed: ${response?.status} ${response?.statusText}`,
    );
    return null;
  }

  return response.json();
}

/**
 * Fetch raw file content from GitHub
 * @param owner - Repository owner
 * @param repo - Repository name
 * @param branch - Branch name
 * @param path - File path
 * @param env - Environment for GitHub token
 * @param useAuth - Whether to use authentication
 */
export async function fetchRawFile(
  owner: string,
  repo: string,
  branch: string,
  path: string,
  env: Env,
  useAuth = false,
): Promise<string | null> {
  const url = constructGithubUrl(owner, repo, branch, path);

  // Raw GitHub content doesn't need the GitHub API token
  // But we still use the client for rate limiting
  const response = await githubApiRequest(url, {}, env, 0, useAuth);

  if (!response || !response.ok) {
    return null;
  }

  return response.text();
}
