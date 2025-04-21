import { describe, it, expect } from "vitest";
import { enforceToolNameLengthLimit, LIMIT } from "./commonTools";
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
