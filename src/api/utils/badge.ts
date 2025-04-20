/**
 * Badge utilities for GitMCP documentation tracking
 */

/**
 * Gets a Durable Object stub for the view counter
 * @param env Cloudflare environment
 * @param owner Repository owner/organization
 * @param repo Repository name
 * @returns The Durable Object stub
 */
function getViewCounterStub(
  env: CloudflareEnvironment,
  owner: string,
  repo: string,
) {
  try {
    const key = `${owner}/${repo}`;
    // Create a deterministic ID based on the repository key
    const id = env.VIEW_COUNTER.idFromName(key);
    // Get the stub of the Durable Object with that ID
    return env.VIEW_COUNTER.get(id);
  } catch (error) {
    console.error(`Error getting view counter stub:`, error);
    return null;
  }
}

/**
 * Increments the view count for a specific repository
 * This operation is "fire and forget" and will never throw an error
 * or block the calling code - designed to be completely non-blocking
 *
 * @param env Cloudflare environment
 * @param owner Repository owner/organization
 * @param repo Repository name
 * @returns The new count or 0 if there was an error
 */
export async function incrementRepoViewCount(
  env: CloudflareEnvironment,
  owner: string,
  repo: string,
): Promise<number> {
  if (!env?.VIEW_COUNTER) {
    console.warn("VIEW_COUNTER binding not available");
    return 0;
  }

  try {
    const stub = getViewCounterStub(env, owner, repo);
    if (!stub) return 0;

    // Send a POST request to the Durable Object to increment the count
    // Add a timeout to ensure we don't hang
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 1000); // 1 second timeout

    try {
      const response = await stub.fetch(`https://counter/${owner}/${repo}`, {
        method: "POST",
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        console.warn(
          `Counter response not OK: ${response.status} ${response.statusText}`,
        );
        return 0;
      }

      const data = await response.json<{ count: number }>();
      return data.count;
    } catch (fetchError) {
      clearTimeout(timeoutId);
      console.error(`Failed to increment counter via fetch:`, fetchError);
      return 0;
    }
  } catch (error) {
    console.error(`Error incrementing repo view count:`, error);
    return 0;
  }
}

/**
 * Gets the current view count for a specific repository
 * This operation should never throw or cause disruption in the calling code
 *
 * @param env Cloudflare environment
 * @param owner Repository owner/organization
 * @param repo Repository name
 * @returns The current count or 0 if there was an error
 */
export async function getRepoViewCount(
  env: CloudflareEnvironment,
  owner: string,
  repo: string,
): Promise<number> {
  if (!env?.VIEW_COUNTER) {
    console.warn("VIEW_COUNTER binding not available");
    return 0;
  }

  try {
    const stub = getViewCounterStub(env, owner, repo);
    if (!stub) return 0;

    // Send a GET request to the Durable Object to get the count
    // Add a timeout to ensure we don't hang
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 1000); // 1 second timeout

    try {
      const response = await stub.fetch(`https://counter/${owner}/${repo}`, {
        method: "GET",
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        console.warn(
          `Counter response not OK: ${response.status} ${response.statusText}`,
        );
        return 0;
      }

      const data = await response.json<{ count: number }>();
      return data.count;
    } catch (fetchError) {
      clearTimeout(timeoutId);
      console.error(`Failed to get counter via fetch:`, fetchError);
      return 0;
    }
  } catch (error) {
    console.error(`Error getting repo view count:`, error);
    return 0;
  }
}

/**
 * Wrapper for tool callbacks that increments the view count for a repository
 * whenever an MCP tool is called to access the repository's data.
 *
 * This ensures we accurately track how often each repository is accessed through
 * GitMCP's MCP protocol. Every MCP tool call for a specific repository
 * (documentation fetch, documentation search, code search) will increment the counter.
 *
 * The implementation ensures that count failures will never impact tool execution.
 *
 * @param env Cloudflare environment
 * @param ctx Execution context or Durable Object state
 * @param repoData Repository data containing owner and repo
 * @param originalCallback The original tool callback function
 * @returns A new callback function that increments the view count before calling the original
 */
export function withViewTracking<T, R>(
  env: CloudflareEnvironment,
  ctx: ExecutionContext | any, // Accept any context type that might have waitUntil
  repoData: { owner: string | null; repo: string | null },
  originalCallback: (args: T) => Promise<R>,
): (args: T) => Promise<R> {
  return async (args: T) => {
    // Only track if we have both owner and repo and counter binding available
    if (repoData.owner && repoData.repo && env?.VIEW_COUNTER) {
      // Handle the view count tracking
      try {
        const incrementPromise = incrementRepoViewCount(
          env,
          repoData.owner,
          repoData.repo,
        );

        // Use waitUntil if available (on ExecutionContext), otherwise just fire and forget
        if (ctx && typeof ctx.waitUntil === "function") {
          // We wrap in an additional Promise that always resolves so waitUntil will never reject
          ctx.waitUntil(
            incrementPromise.catch((err) => {
              console.error("Error incrementing repo view count:", err);
              return 0; // Always resolve, never reject
            }),
          );
        } else {
          // Just fire and forget without awaiting
          incrementPromise.catch((err) => {
            console.error("Error incrementing repo view count:", err);
            return 0;
          });
        }
      } catch (error) {
        // Just log the error and continue, never let it affect the main execution
        console.error("Error in view tracking:", error);
      }
    }

    // Call the original callback and return its result
    return originalCallback(args);
  };
}

/**
 * Generates a shields.io-compatible JSON response for a badge
 * @param count The view count to display
 * @param label The label text (defaults to "GitMCP")
 * @param color The badge color (defaults to "blue")
 * @returns JSON response for shields.io endpoint
 */
export function generateBadgeResponse(
  count: number,
  label: string = "GitMCP",
  color: string = "blue",
): Response {
  const badgeData = {
    schemaVersion: 1,
    label,
    message: count.toString(),
    color,
    cacheSeconds: 300, // Cache for 5 minutes
  };

  return new Response(JSON.stringify(badgeData), {
    headers: {
      "Content-Type": "application/json",
      "Cache-Control": "max-age=300, s-maxage=300", // Cache for 5 minutes
      "Access-Control-Allow-Origin": "*", // Allow shields.io to access the endpoint
    },
  });
}
