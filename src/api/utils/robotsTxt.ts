import {
  cacheRobotsTxt,
  fetchUrlContent,
  getCachedRobotsTxt,
} from "./cache.js";
/**
 * Interface for robots.txt rule
 */
export interface RobotsRule {
  userAgent: string;
  disallow: string[];
  allow: string[];
}

/**
 * Parse robots.txt content into structured rules
 * @param content - The content of robots.txt
 * @returns Array of parsed rules
 */
function parseRobotsTxt(content: string): RobotsRule[] {
  const lines = content.split("\n");
  const rules: RobotsRule[] = [];

  let currentRule: RobotsRule | null = null;

  for (const line of lines) {
    const trimmedLine = line.trim();

    // Skip comments and empty lines
    if (!trimmedLine || trimmedLine.startsWith("#")) {
      continue;
    }

    // Split into directive and value
    const [directive, ...valueParts] = trimmedLine.split(":");
    const value = valueParts.join(":").trim();

    if (!directive || !value) {
      continue;
    }

    const directiveLower = directive.trim().toLowerCase();

    // Start a new rule when encountering a User-agent directive
    if (directiveLower === "user-agent") {
      if (currentRule && currentRule.userAgent) {
        rules.push(currentRule);
      }
      currentRule = { userAgent: value, disallow: [], allow: [] };
    }
    // Add disallow paths
    else if (directiveLower === "disallow" && currentRule) {
      currentRule.disallow.push(value);
    }
    // Add allow paths
    else if (directiveLower === "allow" && currentRule) {
      currentRule.allow.push(value);
    }
  }

  // Add the last rule if exists
  if (currentRule && currentRule.userAgent) {
    rules.push(currentRule);
  }

  return rules;
}

/**
 * Check if a path is allowed according to robots.txt rules
 * @param rules - The parsed robots.txt rules
 * @param path - The path to check
 * @returns boolean indicating if access is allowed
 */
function isPathAllowed(rules: RobotsRule[], path: string): boolean {
  // Path should start with a slash
  if (!path.startsWith("/")) {
    path = "/" + path;
  }

  // First find the applicable rule set (for * or for our user agent)
  // We'll use * since we don't specify a specific user agent
  let applicableRules = rules.find((rule) => rule.userAgent === "*");

  // If no wildcard rules, check if any rules apply at all
  if (!applicableRules && rules.length > 0) {
    applicableRules = rules[0]; // Use the first rule as default
  }

  // If no applicable rules or empty rules, allow access
  if (
    !applicableRules ||
    (applicableRules.disallow.length === 0 &&
      applicableRules.allow.length === 0)
  ) {
    return true;
  }

  // Check specific allow rules (these take precedence over disallow)
  for (const allowPath of applicableRules.allow) {
    if (path.startsWith(allowPath)) {
      return true;
    }
  }

  // Check disallow rules
  for (const disallowPath of applicableRules.disallow) {
    if (disallowPath === "/" || path.startsWith(disallowPath)) {
      return false;
    }
  }

  // Default to allow if no disallow rules match
  return true;
}

/**
 * Check if a specific URL is allowed according to robots.txt rules
 * @param domain - The domain to check
 * @param path - The complete path to check including the file (should start with /)
 * @param env - Environment with Cloudflare bindings
 * @returns boolean indicating if access is allowed
 */
export async function checkRobotsTxt(
  domain: string,
  path: string,
  env: Env,
): Promise<boolean> {
  try {
    const cachedRules = await getCachedRobotsTxt(domain, env);

    if (cachedRules) {
      console.log(
        `Using cached robots.txt rules for ${domain} to check ${path}`,
      );
      return isPathAllowed(cachedRules, path);
    }

    // Fetch robots.txt if not in cache
    const robotsTxtUrl = `https://${domain}/robots.txt`;
    console.log(`Fetching robots.txt from ${robotsTxtUrl}`);
    const response = await fetch(robotsTxtUrl);

    // If robots.txt doesn't exist or can't be accessed, allow access by default
    if (!response.ok) {
      console.log(`No robots.txt found for ${domain} or couldn't be accessed`);
      // Cache empty rules for domains without robots.txt
      await cacheRobotsTxt(domain, [], env);
      return true;
    }

    const content = await response.text();
    const rules = parseRobotsTxt(content);

    // Cache the parsed rules in Upstash
    await cacheRobotsTxt(domain, rules, env);
    console.log(`Cached robots.txt rules for ${domain}`);

    return isPathAllowed(rules, path);
  } catch (error) {
    console.warn(`Error checking robots.txt for ${domain}:`, error);
    // In case of errors, allow access by default
    return true;
  }
}

/**
 * Safely fetch a file after checking robots.txt permissions
 * @param url - Complete URL to fetch
 * @param env - Environment with Cloudflare bindings
 * @returns File content or null if not allowed or not found
 */
export async function fetchFileWithRobotsTxtCheck(
  url: string,
  env: Env,
): Promise<{ content: string | null; blockedByRobots: boolean }> {
  try {
    const urlObj = new URL(url);
    // Create path from URL path + filename
    const path = urlObj.pathname;

    // Check robots.txt before attempting to fetch
    const isAllowed = await checkRobotsTxt(urlObj.hostname, path, env);

    if (!isAllowed) {
      console.log(`Access to ${url} disallowed by robots.txt`);
      return { content: null, blockedByRobots: true };
    }

    // If allowed, use cached content or fetch
    const content = await fetchUrlContent({
      url,
      format: "text",
    });

    return {
      content: content,
      blockedByRobots: false,
    };
  } catch (error) {
    console.warn(`Error fetching ${url}: ${error}`);
    return { content: null, blockedByRobots: false };
  }
}
