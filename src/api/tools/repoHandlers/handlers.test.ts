import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { getHandlerByRepoData } from "./handlers.js";
import type { RequestData } from "../../../shared/repoData.js";
import { getRepoData } from "../../../shared/repoData.js";

describe("getHandlerByRepoData", () => {
  it("should return the correct handler for three.js", () => {
    const requests: RequestData[] = [
      {
        requestHost: "gitmcp.io",
        requestUrl: "/mrdoob/three.js",
      },
      {
        requestHost: "mrdoob.gitmcp.io",
        requestUrl: "/three.js",
      },
    ];
    requests.forEach((request) => {
      const repoData = getRepoData(request);
      const handler = getHandlerByRepoData(repoData);
      expect(handler.name).toBe("threejs");
    });
  });
  it("should return the generic handler for generic repos", () => {
    const requests: RequestData[] = [
      {
        requestHost: "gitmcp.io",
        requestUrl: "/docs",
      },
      {
        requestHost: "docs.gitmcp.io",
        requestUrl: "/",
      },
    ];
    requests.forEach((request) => {
      const repoData = getRepoData(request);
      const handler = getHandlerByRepoData(repoData);
      expect(handler.name).toBe("generic");
    });
  });
  it("should not return the generic handler urls that only look generic ", () => {
    const requests: RequestData[] = [
      {
        requestHost: "docs.gitmcp.io",
        requestUrl: "/some-repo",
      },
      {
        requestHost: "gitmcp.io",
        requestUrl: "/docs/other-path",
      },
    ];
    requests.forEach((request) => {
      const repoData = getRepoData(request);
      const handler = getHandlerByRepoData(repoData);
      expect(handler.name).not.toBe("generic");
    });
  });
  it("should return the react-router handler for react-router", () => {
    const repoData = getRepoData({
      requestHost: "gitmcp.io",
      requestUrl: "/remix-run/react-router",
    });
    const handler = getHandlerByRepoData(repoData);
    expect(handler.name).toBe("react-router");
  });
  it("should return the default handler for other repos", () => {
    const requests: RequestData[] = [
      {
        requestHost: "gitmcp.io",
        requestUrl: "/some-owner/some-repo",
      },
      {
        requestHost: "owner.gitmcp.io",
        requestUrl: "/some-repo",
      },
    ];
    requests.forEach((request) => {
      const repoData = getRepoData(request);
      const handler = getHandlerByRepoData(repoData);
      expect(handler.name).toBe("default");
    });
  });
});
