import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import * as toolsModule from "./index";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z, ZodRawShape } from "zod";
// Mock the fetch function
global.fetch = vi.fn();

// Access the non-exported fetchFile function through dynamic require
const { default: fetchFile } = vi.hoisted(() => {
  return {
    default: vi.fn().mockImplementation(async (url: string) => {
      try {
        const response = await fetch(url);
        return response.ok ? await response.text() : null;
      } catch {
        return null;
      }
    }),
  };
});

describe("Tools Module", () => {
  // Reset mocks before each test
  beforeEach(() => {
    vi.resetAllMocks();
  });

  // Clean up after tests
  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe("Tool registration", () => {
    it("should register tool names correctly for https://gitmcp.io/myorg/myrepo", () => {
      const mockMcp = new MockMcp();

      toolsModule.registerTools(
        mockMcp as unknown as McpServer,
        "gitmcp.io",
        "https://gitmcp.io/myorg/myrepo",
      );

      expect(mockMcp.getTools()).toEqual({
        fetch_myrepo_documentation: {
          description:
            "Fetch entire documentation file from GitHub repository: myorg/myrepo. Useful for general questions.",
        },
        search_myrepo_documentation: {
          description:
            "Semantically search within the fetched documentation from GitHub repository: myorg/myrepo. Useful for specific queries. Don't call if you already used fetch_documentation.",
        },
      });
    });

    it("should register tool names correctly for https://myorg.gitmcp.io/myrepo", () => {
      const mockMcp = new MockMcp();

      toolsModule.registerTools(
        mockMcp as unknown as McpServer,
        "myorg.gitmcp.io",
        "https://myorg.gitmcp.io/myrepo",
      );

      expect(mockMcp.getTools()).toEqual({
        fetch_myrepo_documentation: {
          description:
            "Fetch entire documentation file from the myorg/myrepo GitHub Pages. Useful for general questions.",
        },
        search_myrepo_documentation: {
          description:
            "Semantically search within the fetched documentation from the myorg/myrepo GitHub Pages. Useful for specific queries. Don't call if you already used fetch_documentation.",
        },
      });
    });
  });
});

class MockMcp {
  #tools: Record<
    string,
    {
      description: string;
      cb: (args: Record<string, any>) => Promise<any>;
    }
  > = {};

  tool(
    name: string,
    description: string,
    paramsSchema: ZodRawShape,
    cb: (args: Record<string, any>) => Promise<any>,
  ): void {
    this.#tools[name] = { description, cb };
  }

  getTool(name: string) {
    return this.#tools[name];
  }

  getTools() {
    // filter out the cb from the tools
    return Object.fromEntries(
      Object.entries(this.#tools).map(([name, { description }]) => [
        name,
        { description },
      ]),
    );
  }
}
