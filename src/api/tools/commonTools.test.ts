import { describe, it, expect } from "vitest";
import { enforceToolNameLengthLimit } from "./commonTools";

describe("enforceToolNameLengthLimit", () => {
  it("should return a tool name that is less than 50 characters", () => {
    const toolName = enforceToolNameLengthLimit(
      "search_",
      "nestjs-context-logger",
      "_docs",
    );
    expect(toolName).toBe("search_repo_docs");
    expect(toolName.length).toBeLessThan(50);
  });

  it("should preserve the original tool name if it's already less than 50 characters", () => {
    const toolName = enforceToolNameLengthLimit(
      "search_",
      "playwright-mcp",
      "_docs",
    );
    expect(toolName).toBe("search_playwright_mcp_docs");
    expect(toolName.length).toBeLessThan(50);
  });
});
