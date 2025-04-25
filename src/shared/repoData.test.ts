import { getRepoData, getRepoDataFromUrl, HOST_TEMP_URL } from "./repoData";
import type { RepoData } from "./repoData";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

const testCases: {
  title: string;
  input: { requestHost: string; requestUrls: string[] };
  expected: RepoData;
}[] = [
  {
    title: "git-mcp.idosalomon.workers.dev",
    input: {
      requestHost: "git-mcp.idosalomon.workers.dev",
      requestUrls: [
        "https://git-mcp.idosalomon.workers.dev/mrdoob/three.js",
        "/mrdoob/three.js",
      ],
    },
    expected: {
      owner: "mrdoob",
      repo: "three.js",
      urlType: "github",
      host: "git-mcp.idosalomon.workers.dev",
    },
  },
  {
    title: "gitmcp.io",
    input: {
      requestHost: "gitmcp.io",
      requestUrls: ["https://gitmcp.io/mrdoob/three.js", "/mrdoob/three.js"],
    },
    expected: {
      owner: "mrdoob",
      repo: "three.js",
      urlType: "github",
      host: "gitmcp.io",
    },
  },
  {
    title: "myOwner.gitmcp.io",
    input: {
      requestHost: "ownerName.gitmcp.io",
      requestUrls: ["https://ownerName.gitmcp.io/repoName", "/repoName"],
    },
    expected: {
      owner: "ownerName",
      repo: "repoName",
      urlType: "subdomain",
      host: "ownerName.gitmcp.io",
    },
  },
  {
    title: "generic (docs)",
    input: {
      requestHost: "gitmcp.io",
      requestUrls: ["https://gitmcp.io/docs", "/docs"],
    },
    expected: {
      owner: "docs",
      repo: null,
      urlType: "github",
      host: "gitmcp.io",
    },
  },
  {
    title: "generic (docs) subdomain",
    input: {
      requestHost: "docs.gitmcp.io",
      requestUrls: ["https://docs.gitmcp.io/"],
    },
    expected: {
      owner: "docs",
      repo: null,
      urlType: "subdomain",
      host: "docs.gitmcp.io",
    },
  },
  {
    title: HOST_TEMP_URL,
    input: {
      requestHost: HOST_TEMP_URL,
      requestUrls: [
        `https://${HOST_TEMP_URL}/myOwner/myRepo`,
        `/myOwner/myRepo`,
      ],
    },
    expected: {
      owner: "myOwner",
      repo: "myRepo",
      urlType: "github",
      host: HOST_TEMP_URL,
    },
  },
  {
    title: "unknown",
    input: {
      requestHost: "test.com",
      requestUrls: ["https://test.com/myOwner/myRepo", "/myOwner/myRepo"],
    },
    expected: {
      owner: null,
      repo: null,
      urlType: "unknown",
      host: "test.com",
    },
  },
  {
    title: "localhost",
    input: {
      requestHost: "localhost",
      requestUrls: [
        "http://localhost:3000/mrdoob/three.js",
        "/mrdoob/three.js",
      ],
    },
    expected: {
      owner: "mrdoob",
      repo: "three.js",
      urlType: "github",
      host: "localhost",
    },
  },
];

describe("RepoData", () => {
  testCases.forEach((testCase) => {
    describe(`should return the correct repo data for ${testCase.title}`, () => {
      testCase.input.requestUrls.forEach((requestUrl) => {
        it(`should return the correct repo data for ${testCase.input.requestHost} + ${requestUrl}`, () => {
          const result = getRepoData({
            requestHost: testCase.input.requestHost,
            requestUrl,
          });
          expect(result).toEqual(testCase.expected);
        });
      });
    });
  });
});

const flatTestCases = {
  "microsoft/playwright-mcp": [
    "https://github.com/microsoft/playwright-mcp",
    "https://github.com/microsoft/playwright-mcp/blob/main/src/mcp-server.ts",
    "https://microsoft.github.io/playwright-mcp",
    "https://microsoft.github.io/playwright-mcp/blob/main/src/mcp-server.ts",
    "https://gitmcp.io/microsoft/playwright-mcp",
    "https://gitmcp.io/microsoft/playwright-mcp/blob/main/src/mcp-server.ts",
    "https://microsoft.gitmcp.io/playwright-mcp",
    "https://microsoft.gitmcp.io/playwright-mcp/blob/main/src/mcp-server.ts",
    "github.com/microsoft/playwright-mcp",
    "github.com/microsoft/playwright-mcp/blob/main/src/mcp-server.ts",
    "microsoft.github.io/playwright-mcp",
    "microsoft.github.io/playwright-mcp/blob/main/src/mcp-server.ts",
    "gitmcp.io/microsoft/playwright-mcp",
    "gitmcp.io/microsoft/playwright-mcp/blob/main/src/mcp-server.ts",
    "microsoft.gitmcp.io/playwright-mcp",
    "microsoft.gitmcp.io/playwright-mcp/blob/main/src/mcp-server.ts",
    "microsoft/playwright-mcp",
    "http://localhost:3000/microsoft/playwright-mcp",
    "localhost:3000/microsoft/playwright-mcp/blob/main/src/mcp-server.ts",
    `${HOST_TEMP_URL}/microsoft/playwright-mcp`,
  ],
  "null/null": [
    "microsoft.gitrmcp.io/playwright-mcp/blob/main/src/mcp-server.ts",
    "localhost:a/microsoft/playwright-mcp/blob/main/src/mcp-server.ts",
  ],
  "docs/null": [
    "docs.gitmcp.io",
    "docs.github.io",
    "gitmcp.io/docs",
    "localhost:3000/docs",
  ],
};
describe("getRepoDataFromUrl", () => {
  Object.entries(flatTestCases).forEach(([testCase, urls]) => {
    it(`should return the correct repo data for ${testCase}`, () => {
      urls.forEach((url) => {
        const result = getRepoDataFromUrl(url);
        expect(`${result.owner}/${result.repo ?? null}`).toEqual(testCase);
      });
    });
  });
});
