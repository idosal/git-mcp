export type UrlType = "subdomain" | "github" | "unknown";
export type RepoData = {
  owner: string | null;
  repo: string | null;
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
      repo: path,
      host: requestHost,
      urlType: "subdomain",
    };
  }
  // Check for github repo pattern: gitmcp.io/{owner}/{repo}, git-mcp.vercel.app/{owner}/{repo},
  // or git-mcp-git-{preview}-git-mcp.vercel.app/{owner}/{repo}
  else if (
    requestHost === "gitmcp.io" ||
    requestHost === "git-mcp.vercel.app" ||
    /^git-mcp-git-.*-git-mcp\.vercel\.app$/.test(requestHost) ||
    requestHost.includes("localhost")
  ) {
    // Extract owner/repo from path
    const splitPath = path.split("/");
    const owner = splitPath.at(0) ?? null;
    const repo = splitPath.at(1) ?? null;
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
