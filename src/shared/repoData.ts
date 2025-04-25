export type UrlType = "subdomain" | "github" | "unknown";
export type MinimalRepoData = {
  owner: string | null;
  repo: string | null;
};

export type RepoData = MinimalRepoData & {
  host: string;
  urlType: UrlType;
};
export type RequestData = {
  requestHost: string;
  requestUrl?: string;
};
export type LogData = RepoData & RequestData;

export function getRepoData(requestData: RequestData): RepoData {
  const { requestHost, requestUrl } = requestData;

  // Parse the URL if provided
  const logData: LogData = {
    owner: null,
    repo: null,
    host: requestHost,
    urlType: "unknown",
    requestUrl,
    requestHost,
  };
  const protocol = requestHost.includes("localhost") ? "http" : "https";
  let fullUrl = new URL(`${protocol}://${requestHost}`);
  if (requestUrl) {
    if (requestUrl.startsWith("/")) {
      fullUrl = new URL(`${protocol}://${requestHost}${requestUrl}`);
    } else if (requestUrl.startsWith("http")) {
      fullUrl = new URL(requestUrl);
    } else {
      fullUrl = new URL(`${protocol}://${requestUrl}`);
    }
  }
  const path = fullUrl.pathname.split("/").filter(Boolean).join("/");

  // Check for subdomain pattern: {subdomain}.gitmcp.io/{path}
  if (requestHost.includes(".gitmcp.io")) {
    const subdomain = requestHost.split(".")[0];
    logData.owner = subdomain;
    logData.repo = path;
    logData.urlType = "subdomain";
    log("getRepoDataLog", JSON.stringify(logData, null, 2));

    if (!subdomain && !path) {
      console.error("Invalid repository data:", logData);
      throw new Error(
        `Invalid repository data: ${JSON.stringify(logData, null, 2)}`,
      );
    }

    return {
      owner: subdomain,
      repo: path || null,
      host: requestHost,
      urlType: "subdomain",
    };
  }
  // Check for github repo pattern: gitmcp.io/{owner}/{repo}, HOST_TEMP_URL/{owner}/{repo},
  // or git-mcp-git-{preview}-git-mcp.vercel.app/{owner}/{repo}
  else if (
    requestHost === "gitmcp.io" ||
    requestHost === HOST_TEMP_URL ||
    requestHost === "git-mcp.idosalomon.workers.dev" ||
    requestHost.includes("localhost")
  ) {
    // Extract owner/repo from path
    const splitPath = path.split("/");
    const owner = splitPath.at(0) ?? null;
    let repo = splitPath.at(1) ?? null;
    // FIXME: this is a hack to support the chat page
    if (owner == "docs" && repo == "chat") {
      repo = null;
    }
    logData.owner = owner;
    logData.repo = repo;
    logData.urlType = "github";
    log("getRepoDataLog", JSON.stringify(logData, null, 2));

    if (!owner && !repo) {
      console.error("Invalid repository data:", logData);
      throw new Error(
        `Invalid repository data: ${JSON.stringify(logData, null, 2)}`,
      );
    }

    return {
      owner,
      repo,
      host: requestHost,
      urlType: "github",
    };
  }

  logData.urlType = "unknown";
  log("getRepoDataLog", JSON.stringify(logData, null, 2));

  return {
    owner: null,
    repo: null,
    host: requestHost,
    urlType: "unknown",
  };
}

function log(...args: any[]) {
  console.log(...args);
}

export const HOST_TEMP_URL = "remote-mcp-server-cf.idosalomon.workers.dev";

export function getRepoDataFromUrl(url: string): MinimalRepoData {
  // Handle simple owner/repo format
  if (!url.includes("/") && !url.includes(".")) {
    return { owner: null, repo: null };
  }

  // Remove protocol if present
  const urlWithoutProtocol = url.replace(/^https?:\/\//, "");

  const urlReference = urlWithoutProtocol
    .replace(".github.io", ".gitmcp.io")
    .replace(/^github\.com/, "gitmcp.io")
    .replace(HOST_TEMP_URL, "gitmcp.io")
    .replace("git-mcp.idosalomon.workers.dev", "gitmcp.io")
    .replace(/^localhost:?[0-9]+/, "gitmcp.io");

  // Different URL patterns
  const patterns = [
    // gitmcp.io/owner/repo
    /^(?:www\.)?gitmcp\.io\/([^\/]+)\/([^\/]+)/,
    // owner.gitmcp.io/repo
    /^(?:www\.)?([^\/]+)\.gitmcp\.io\/([^\/]+)/,
    // owner.gitmcp.io
    /^(?:www\.)?([^\/]+)\.gitmcp\.io/,
    // gitmcp.io/docs
    /^(?:www\.)?gitmcp\.io\/(docs)/,
    // Simple owner/repo format
    /^([a-zA-Z0-9_-]+)\/([a-zA-Z0-9_-]+)/,
  ];

  for (const pattern of patterns) {
    const match = urlReference.match(pattern);
    if (match) {
      return { owner: match[1], repo: match[2] };
    }
  }

  // Default fallback
  return { owner: null, repo: null };
}
