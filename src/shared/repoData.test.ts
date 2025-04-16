import { getRepoData, HOST_TEMP_URL } from "./repoData";
import type { RepoData } from "./repoData";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

const testCases: {
  title: string;
  input: { requestHost: string; requestUrls: string[] };
  expected: RepoData;
}[] = [
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
