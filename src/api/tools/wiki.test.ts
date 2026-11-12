import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { fetchRepositoryWiki } from "./commonTools";
import type { RepoData } from "../../shared/repoData";

// @ts-ignore
const mockEnv: Env = {};

const repoData: RepoData = {
  owner: "myorg",
  repo: "myrepo",
  host: "gitmcp.io",
  urlType: "github",
};

const RAW_BASE = "https://raw.githubusercontent.com/wiki/myorg/myrepo";
const PAGES_URL = "https://github.com/myorg/myrepo/wiki/_pages";

const PAGES_HTML = `
  <a href="/myorg/myrepo/wiki">Wiki</a>
  <a href="/myorg/myrepo/wiki/_new">New page</a>
  <a href="/myorg/myrepo/wiki/Home">Home</a>
  <a href="/myorg/myrepo/wiki/Getting-Started">Getting Started</a>
  <a href="/myorg/myrepo/wiki/FAQ">FAQ</a>
`;

function mockFetch(responses: Record<string, string>) {
  const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
    const url = input.toString();
    if (url in responses) {
      return new Response(responses[url], { status: 200 });
    }
    return new Response("Not Found", { status: 404 });
  });
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

function requestedUrls(fetchMock: ReturnType<typeof mockFetch>): string[] {
  return fetchMock.mock.calls.map(([input]) => input.toString());
}

describe("fetchRepositoryWiki", () => {
  beforeEach(() => {
    vi.spyOn(console, "log").mockImplementation(() => {});
    vi.spyOn(console, "warn").mockImplementation(() => {});
    vi.spyOn(console, "error").mockImplementation(() => {});
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it("lists the wiki pages and returns the Home page when no page is given", async () => {
    mockFetch({
      [PAGES_URL]: PAGES_HTML,
      [`${RAW_BASE}/Home.md`]: "Welcome to the wiki",
    });

    const result = await fetchRepositoryWiki({ repoData, env: mockEnv });

    expect(result.status).toBe("success");
    expect(result.page).toBe("Home");
    expect(result.url).toBe("https://github.com/myorg/myrepo/wiki/Home");
    const text = result.content[0].text;
    expect(text).toContain(
      "- Home (page: `Home`)\n- FAQ (page: `FAQ`)\n- Getting Started (page: `Getting-Started`)",
    );
    expect(text).toContain("Welcome to the wiki");
  });

  it("lists the pages even if the wiki has no Home page", async () => {
    mockFetch({ [PAGES_URL]: PAGES_HTML });

    const result = await fetchRepositoryWiki({ repoData, env: mockEnv });

    expect(result.status).toBe("success");
    expect(result.page).toBeNull();
    expect(result.content[0].text).toContain(
      "- FAQ (page: `FAQ`)\n- Getting Started (page: `Getting-Started`)",
    );
    expect(result.content[0].text).not.toContain("Home");
  });

  it("reports when the repository has no wiki", async () => {
    // GitHub redirects /wiki/_pages to the repository page when there is no wiki
    mockFetch({ [PAGES_URL]: '<a href="/myorg/myrepo/wiki">Wiki</a>' });

    const result = await fetchRepositoryWiki({ repoData, env: mockEnv });

    expect(result.status).toBe("not_found");
    expect(result.content[0].text).toContain(
      "No GitHub wiki pages found for myorg/myrepo",
    );
  });

  it("fetches a page by title", async () => {
    const fetchMock = mockFetch({
      [`${RAW_BASE}/Getting-Started.md`]: "# Install\n\nRun the installer.",
    });

    const result = await fetchRepositoryWiki({
      repoData,
      page: "Getting Started",
      env: mockEnv,
    });

    expect(result.status).toBe("success");
    expect(result.page).toBe("Getting-Started");
    expect(result.url).toBe(
      "https://github.com/myorg/myrepo/wiki/Getting-Started",
    );
    expect(result.content[0].text).toBe(
      "# Getting Started\n\nSource: https://github.com/myorg/myrepo/wiki/Getting-Started\n\n# Install\n\nRun the installer.",
    );
    expect(requestedUrls(fetchMock)).not.toContain(PAGES_URL);
  });

  it("falls back to a case-insensitive match of the page name", async () => {
    mockFetch({
      [PAGES_URL]: PAGES_HTML,
      [`${RAW_BASE}/Getting-Started.md`]: "Run the installer.",
    });

    const result = await fetchRepositoryWiki({
      repoData,
      page: "getting started",
      env: mockEnv,
    });

    expect(result.status).toBe("success");
    expect(result.page).toBe("Getting-Started");
    expect(result.content[0].text).toContain("Run the installer.");
  });

  it("lists the available pages when the page does not exist", async () => {
    mockFetch({
      [PAGES_URL]: PAGES_HTML,
      [`${RAW_BASE}/Home.md`]: "Welcome",
    });

    const result = await fetchRepositoryWiki({
      repoData,
      page: "Missing Page",
      env: mockEnv,
    });

    expect(result.status).toBe("not_found");
    expect(result.content[0].text).toContain(
      'Wiki page "Missing Page" was not found for myorg/myrepo. Available pages:',
    );
    expect(result.content[0].text).toContain(
      "- Getting Started (page: `Getting-Started`)",
    );
  });

  it("respects robots.txt", async () => {
    mockFetch({
      "https://raw.githubusercontent.com/robots.txt":
        "User-agent: *\nDisallow: /wiki/",
    });

    const result = await fetchRepositoryWiki({
      repoData,
      page: "FAQ",
      env: mockEnv,
    });

    expect(result.status).toBe("blocked");
    expect(result.content[0].text).toContain("disallowed by robots.txt");
  });

  it("returns an error when no repository is specified", async () => {
    const fetchMock = mockFetch({});

    const result = await fetchRepositoryWiki({
      repoData: { ...repoData, owner: null, repo: null },
      env: mockEnv,
    });

    expect(result.status).toBe("error");
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
