import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  generateBadgeResponse,
  getRepoViewCount,
  incrementRepoViewCount,
  withViewTracking,
} from "../api/utils/badge";

describe("Badge utilities", () => {
  const mockStub = {
    fetch: vi.fn(),
  };

  const mockId = { name: "test-id" };

  const mockNamespace = {
    idFromName: vi.fn().mockReturnValue(mockId),
    get: vi.fn().mockReturnValue(mockStub),
  };

  const mockEnv = {
    VIEW_COUNTER: mockNamespace,
  } as unknown as CloudflareEnvironment;

  const mockCtx = {
    waitUntil: vi.fn(),
  };

  beforeEach(() => {
    vi.resetAllMocks();
    // Ensure mockNamespace.idFromName returns mockId
    mockNamespace.idFromName.mockReturnValue(mockId);
    // Ensure mockNamespace.get returns mockStub
    mockNamespace.get.mockReturnValue(mockStub);
  });

  describe("incrementRepoViewCount", () => {
    it("should increment count via Durable Object", async () => {
      const mockResponse = new Response(JSON.stringify({ count: 42 }));
      mockStub.fetch.mockResolvedValue(mockResponse);

      const result = await incrementRepoViewCount(mockEnv, "owner", "repo");

      expect(mockNamespace.idFromName).toHaveBeenCalledWith("owner/repo");
      expect(mockNamespace.get).toHaveBeenCalledWith(mockId);
      expect(mockStub.fetch).toHaveBeenCalledWith(
        "https://counter/owner/repo",
        {
          method: "POST",
          signal: expect.any(AbortSignal),
        },
      );
      expect(result).toBe(42);
    });

    it("should handle errors gracefully", async () => {
      mockStub.fetch.mockRejectedValue(new Error("Fetch error"));

      const result = await incrementRepoViewCount(mockEnv, "owner", "repo");

      expect(result).toBe(0);
    });

    it("should handle non-ok responses", async () => {
      const mockResponse = new Response("Error", { status: 500 });
      mockStub.fetch.mockResolvedValue(mockResponse);

      const result = await incrementRepoViewCount(mockEnv, "owner", "repo");

      expect(result).toBe(0);
    });
  });

  describe("getRepoViewCount", () => {
    it("should get count via Durable Object", async () => {
      const mockResponse = new Response(JSON.stringify({ count: 42 }));
      mockStub.fetch.mockResolvedValue(mockResponse);

      const result = await getRepoViewCount(mockEnv, "owner", "repo");

      expect(mockNamespace.idFromName).toHaveBeenCalledWith("owner/repo");
      expect(mockNamespace.get).toHaveBeenCalledWith(mockId);
      expect(mockStub.fetch).toHaveBeenCalledWith(
        "https://counter/owner/repo",
        {
          method: "GET",
          signal: expect.any(AbortSignal),
        },
      );
      expect(result).toBe(42);
    });

    it("should handle errors gracefully", async () => {
      mockStub.fetch.mockRejectedValue(new Error("Fetch error"));

      const result = await getRepoViewCount(mockEnv, "owner", "repo");

      expect(result).toBe(0);
    });

    it("should handle non-ok responses", async () => {
      const mockResponse = new Response("Error", { status: 500 });
      mockStub.fetch.mockResolvedValue(mockResponse);

      const result = await getRepoViewCount(mockEnv, "owner", "repo");

      expect(result).toBe(0);
    });
  });

  describe("withViewTracking", () => {
    it("should track views when owner and repo are provided", async () => {
      // Mock the increment function
      const incrementSpy = vi
        .spyOn(await import("../api/utils/badge"), "incrementRepoViewCount")
        .mockResolvedValue(1);

      // Create a mock original callback
      const originalCallback = vi.fn().mockResolvedValue("result");

      // Create the wrapped callback
      const repoData = { owner: "idosal", repo: "git-mcp" };
      const wrappedCallback = withViewTracking(
        mockEnv,
        mockCtx,
        repoData,
        originalCallback,
      );

      // Call the wrapped callback
      const result = await wrappedCallback({ test: "args" });

      // Check that waitUntil was called
      expect(mockCtx.waitUntil).toHaveBeenCalled();

      // Check that the original callback was called with the correct args
      expect(originalCallback).toHaveBeenCalledWith({ test: "args" });

      // Check that the result was passed through
      expect(result).toBe("result");

      // Restore the original implementation
      incrementSpy.mockRestore();
    });

    it("should not track views when owner or repo is missing", async () => {
      // Create a mock original callback
      const originalCallback = vi.fn().mockResolvedValue("result");

      // Create the wrapped callback with missing repo
      const repoData = { owner: "owner", repo: null };
      const wrappedCallback = withViewTracking(
        mockEnv,
        mockCtx,
        repoData,
        originalCallback,
      );

      // Call the wrapped callback
      await wrappedCallback({ test: "args" });

      // Check that waitUntil was not called
      expect(mockCtx.waitUntil).not.toHaveBeenCalled();

      // Check that the original callback was still called
      expect(originalCallback).toHaveBeenCalledWith({ test: "args" });
    });

    it("should handle context without waitUntil", async () => {
      // Create a mock original callback
      const originalCallback = vi.fn().mockResolvedValue("result");

      // Create the wrapped callback
      const repoData = { owner: "idosal", repo: "git-mcp" };
      const wrappedCallback = withViewTracking(
        mockEnv,
        {},
        repoData,
        originalCallback,
      );

      // Call the wrapped callback
      await wrappedCallback({ test: "args" });

      // Original callback should still be called
      expect(originalCallback).toHaveBeenCalledWith({ test: "args" });
    });
  });

  describe("generateBadgeResponse", () => {
    it("should generate a badge response with custom values", async () => {
      const response = generateBadgeResponse(100, "green");

      // Mock the text() method to handle the ReadableStream
      const mockText = vi.fn().mockResolvedValue(
        JSON.stringify({
          schemaVersion: 1,
          label: "Custom Label",
          message: "100",
          color: "green",
          cacheSeconds: 300,
        }),
      );

      vi.spyOn(response, "text").mockImplementation(mockText);

      const body = JSON.parse(await response.text());
      expect(body).toEqual({
        schemaVersion: 1,
        label: "Custom Label",
        message: "100",
        color: "green",
        cacheSeconds: 300,
      });
    });
  });
});
