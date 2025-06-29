import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import * as toolsModule from "./index";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { MockMcp } from "./repoHandlers/test/utils.js";
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

// @ts-ignore
const mockEnv: Env = {};

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
    const tests: {
      host: string;
      url: string;
      expectedTools: Record<string, { description: string }>;
    }[] = [
      // default handler
      {
        host: "gitmcp.io",
        url: "https://gitmcp.io/myorg/myrepo",
        expectedTools: {
          fetch_myrepo_documentation: {
            description:
              "Fetch entire documentation file from GitHub repository: myorg/myrepo. Useful for general questions. Always call this tool first if asked about myorg/myrepo.",
          },
          search_myrepo_documentation: {
            description:
              "Semantically search within the fetched documentation from GitHub repository: myorg/myrepo. Useful for specific queries.",
          },
          fetch_generic_url_content: {
            description:
              "Generic tool to fetch content from any absolute URL, respecting robots.txt rules. Use this to retrieve referenced urls (absolute urls) that were mentioned in previously fetched documentation.",
          },
          search_myrepo_code: {
            description:
              'Search for code within the GitHub repository: "myorg/myrepo" using the GitHub Search API (exact match). Returns matching files for you to query further if relevant.',
          },
          fetchUsageCodeExamples: {
            description:
              "Fetch code examples that use the given function. Use it when the user asks about code example or how to use his function. Returns code snippets that demonstrate how to call this function.",
          },
        },
      },
      // default handler - subdomain
      {
        host: "myorg.gitmcp.io",
        url: "https://myorg.gitmcp.io/myrepo",
        expectedTools: {
          fetch_myrepo_documentation: {
            description:
              "Fetch entire documentation file from the myorg/myrepo GitHub Pages. Useful for general questions. Always call this tool first if asked about myorg/myrepo.",
          },
          search_myrepo_documentation: {
            description:
              "Semantically search within the fetched documentation from the myorg/myrepo GitHub Pages. Useful for specific queries.",
          },
          fetch_generic_url_content: {
            description:
              "Generic tool to fetch content from any absolute URL, respecting robots.txt rules. Use this to retrieve referenced urls (absolute urls) that were mentioned in previously fetched documentation.",
          },
          search_myrepo_code: {
            description:
              'Search for code within the GitHub repository: "myorg/myrepo" using the GitHub Search API (exact match). Returns matching files for you to query further if relevant.',
          },
          fetchUsageCodeExamples: {
            description:
              "Fetch code examples that use the given function. Use it when the user asks about code example or how to use his function. Returns code snippets that demonstrate how to calls this function.",
          },
        },
      },
      // generic handler
      {
        host: "docs.gitmcp.io",
        url: "https://docs.gitmcp.io",
        expectedTools: {
          fetch_generic_documentation: {
            description:
              "Fetch documentation for any GitHub repository by providing owner and project name",
          },
          search_generic_code: {
            description:
              "Search for code in any GitHub repository by providing owner, project name, and search query. Returns matching files. Supports pagination with 30 results per page.",
          },
          fetch_generic_url_content: {
            description:
              "Generic tool to fetch content from any absolute URL, respecting robots.txt rules. Use this to retrieve referenced urls (absolute urls) that were mentioned in previously fetched documentation.",
          },
          match_common_libs_owner_repo_mapping: {
            description:
              "Match a library name to an owner/repo. Don't use it if you have an owner and repo already. Use this first if only a library name was provided. If found - you can use owner and repo to call other tools. If not found - try to use the library name directly in other tools.",
          },
          search_generic_documentation: {
            description:
              "Semantically search in documentation for any GitHub repository by providing owner, project name, and search query. Useful for specific queries.",
          },
        },
      },
      // three.js handler
      {
        host: "gitmcp.io",
        url: "https://gitmcp.io/mrdoob/three.js",
        expectedTools: {
          fetch_threejs_urls_inside_docs: {
            description:
              "Fetch content from URLs that are inside the reference docs. Usually contains '#' in the url. Returns the content of the pages as markdown.",
          },
          fetch_generic_url_content: {
            description:
              "Generic tool to fetch content from any absolute URL, respecting robots.txt rules. Use this to retrieve referenced urls (absolute urls) that were mentioned in previously fetched documentation.",
          },
          get_threejs_reference_docs_list: {
            description:
              "Get the reference docs list. This should be the first step. It will return a list of all the reference docs and manuals and their corresponding urls.",
          },
          search_threejs_documentation: {
            description:
              "Semantically search the repository documentation for the given query. Use this if you need to find information you don't have in the reference docs.",
          },
          get_threejs_specific_docs_content: {
            description:
              "Get the content of specific docs or manuals. This should be the second step. It will return the content of the specific docs or manuals. You can pass in a list of document or manual names.",
          },
        },
      },
    ];

    tests.forEach((test) => {
      it(`should register tool names correctly for ${test.url}`, () => {
        const mockMcp = new MockMcp();

        toolsModule
          .getMcpTools(mockEnv, test.host, test.url)
          .forEach((tool) => {
            mockMcp.tool(
              tool.name,
              tool.description,
              tool.paramsSchema,
              tool.cb,
            );
          });

        expect(mockMcp.getTools()).toEqual(test.expectedTools);
      });
    });
  });
});
