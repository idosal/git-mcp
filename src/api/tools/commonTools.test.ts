import { afterEach, describe, it, expect, vi } from "vitest";
import {
  enforceToolNameLengthLimit,
  LIMIT,
  searchRepositoryDocumentationAutoRag,
} from "./commonTools";
import { generateServerName } from "../../shared/nameUtils";

describe("enforceToolNameLengthLimit", () => {
  it("should return a tool name that is less than LIMIT characters", () => {
    const repoName = "nestjs-context-logger";
    const toolName = enforceToolNameLengthLimit("fetch_", repoName, "_docs");
    const serverNameLength = generateServerName(repoName).length;
    expect(toolName).toBe("fetch_nestjs_context_docs");
    const totalNameLength = toolName.length + serverNameLength;
    expect(totalNameLength).toBeLessThanOrEqual(LIMIT);
  });

  it("should preserve the original tool name if it's already less than LIMIT characters", () => {
    const toolName = enforceToolNameLengthLimit(
      "search_",
      "playwright-mcp",
      "_docs",
    );
    const serverNameLength = generateServerName("playwright-mcp").length;
    expect(toolName).toBe("search_playwright_mcp_docs");
    const totalNameLength = toolName.length + serverNameLength;
    expect(totalNameLength).toBeLessThanOrEqual(LIMIT);
  });

  it("should return 'repo' if the repo name is too long", () => {
    const repoName = "nestjs-context-logger-is-long";
    const toolName = enforceToolNameLengthLimit("search_", repoName, "_docs");
    const serverNameLength = generateServerName(repoName).length;
    expect(toolName).toBe("search_repo_docs");
    const totalNameLength = toolName.length + serverNameLength;
    expect(totalNameLength).toBeLessThanOrEqual(LIMIT);
  });
  it("should return nothing if the repo name is too long", () => {
    const repoName = "nestjs-context-logger-very-very-long";
    const toolName = enforceToolNameLengthLimit("search_", repoName, "_docs");
    expect(toolName).toBe("search_docs");
  });
});

describe("searchRepositoryDocumentationAutoRag", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("points source follow-ups to the registered generic URL tool", async () => {
    vi.stubGlobal("caches", {
      default: {
        match: vi.fn().mockResolvedValue(undefined),
        put: vi.fn().mockResolvedValue(undefined),
      },
    });
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response(JSON.stringify({ default_branch: "main" }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        }),
      ),
    );

    const search = vi.fn().mockResolvedValue({
      search_query: "configured name",
      data: [
        {
          filename: "owner/repo/docs/guide.md",
          score: 0.9,
          content: [{ text: "A matching documentation excerpt" }],
        },
      ],
    });
    const env = {
      AI: { autorag: vi.fn().mockReturnValue({ search }) },
    } as unknown as CloudflareEnvironment;

    const result = await searchRepositoryDocumentationAutoRag({
      repoData: {
        owner: "owner",
        repo: "repo",
        host: "gitmcp.io",
        urlType: "github",
      },
      query: "configured name",
      env,
      ctx: { waitUntil: vi.fn() },
      autoragPipeline: "test-docs-rag",
    });

    expect(result.content[0].text).toContain("fetch_generic_url_content");
    expect(result.content[0].text).not.toContain("fetch_url_content");
  });
});
