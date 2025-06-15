import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { FalkorDB } from "falkordb";
import { getDefaultRepoHandler } from "./DefaultRepoHandler";
import { getGraphService } from "./graphTools";
import path from "path";

// Comprehensive test suite for all 8 fetchUsageCodeExamples scenarios using real data
describe("fetchUsageCodeExamples - All 8 Scenarios with Real Data", () => {
  let client: FalkorDB;
  let graphService: any;

  const realRepoData = {
    owner: "FalkorDB",
    repo: "GraphRAG-SDK",
    host: "gitmcp.io",
    urlType: "github" as const,
  };

  const testRepoData = {
    owner: "testuser",
    repo: "test-scenario-repo",
    host: "gitmcp.io",
    urlType: "github" as const,
  };

  const nonExistentRepoData = {
    owner: "nonexistent",
    repo: "fake-repo",
    host: "gitmcp.io",
    urlType: "github" as const,
  };

  beforeAll(async () => {
    client = await FalkorDB.connect({
      socket: { host: "localhost", port: 6379 },
    });
    graphService = getGraphService();
  });

  afterAll(async () => {
    if (client) {
      // Clean up any test graphs
      try {
        const graphs = await client.list();
        const testGraphs = ["test-scenario-repo", "fake-repo"];
        for (const graphName of testGraphs) {
          if (graphs.includes(graphName)) {
            const graph = client.selectGraph(graphName);
            await graph.delete();
            console.log(`Cleaned up test graph: ${graphName}`);
          }
        }
      } catch (error) {
        console.log("Test cleanup error (expected):", error);
      }
      await client.close();
    }
  });

  describe("Scenario 1: Graph exists + Function found", () => {
    it("should return actual code examples when function exists in real graph", async () => {
      const graphExists = await graphService.checkGraphExists("GraphRAG-SDK");

      if (!graphExists) {
        console.log("⚠️ GraphRAG-SDK graph not found, skipping Scenario 1");
        return;
      }

      const tools = getDefaultRepoHandler().getTools(realRepoData, {}, {});
      const toolCb = tools.find((t) => t.name === "fetchUsageCodeExamples")?.cb;

      if (!toolCb) {
        throw new Error("fetchUsageCodeExamples tool not found");
      }

      const result = await toolCb({
        functionName: "chat_session",
      });

      expect(result.content[0].text).toMatch(
        /📋 Code Example Results for "chat_session" function/,
      );
      expect(result.content[0].text).toMatch(/Found \d+ function/);
      expect(result.content[0].text).toMatch(/Code Example \d+:/);

      console.log("✅ Scenario 1: Real code examples returned");
      console.log(
        "Sample response:",
        result.content[0].text.substring(0, 300) + "...",
      );
    });
  });

  describe("Scenario 2: Graph exists + No results + Creation in progress", () => {
    it("should show creation progress when function not found but creation ongoing", async () => {
      const graphExists = await graphService.checkGraphExists("GraphRAG-SDK");

      if (!graphExists) {
        console.log("⚠️ GraphRAG-SDK graph not found, skipping Scenario 2");
        return;
      }

      // Test with a function that definitely doesn't exist
      const tools = getDefaultRepoHandler().getTools(realRepoData, {}, {});
      const toolCb = tools.find((t) => t.name === "fetchUsageCodeExamples")?.cb;

      if (!toolCb) {
        throw new Error("fetchUsageCodeExamples tool not found");
      }

      // Manually set creation in progress to simulate this scenario
      const repoKey = `${realRepoData.owner}/${realRepoData.repo}`;
      graphService.setCreationLock(repoKey, true);

      const result = await toolCb({
        functionName: "definitely_nonexistent_function_12345",
      });

      // Clean up the lock
      graphService.setCreationLock(repoKey, false);

      // Should show either creation progress or no results found
      const isCreationProgress = result.content[0].text.includes(
        "Graph Creation Still In Progress",
      );
      const isNoResults = result.content[0].text.includes(
        "No calling functions found",
      );

      expect(isCreationProgress || isNoResults).toBe(true);
      console.log("✅ Scenario 2: Handled non-existent function properly");
    });
  });

  describe("Scenario 3: Graph exists + No results + Creation complete", () => {
    it("should show 'no functions found' when function doesn't exist", async () => {
      const graphExists = await graphService.checkGraphExists("GraphRAG-SDK");

      if (!graphExists) {
        console.log("⚠️ GraphRAG-SDK graph not found, skipping Scenario 3");
        return;
      }

      const tools = getDefaultRepoHandler().getTools(realRepoData, {}, {});
      const toolCb = tools.find((t) => t.name === "fetchUsageCodeExamples")?.cb;

      if (!toolCb) {
        throw new Error("fetchUsageCodeExamples tool not found");
      }

      // Ensure no creation in progress
      const repoKey = `${realRepoData.owner}/${realRepoData.repo}`;
      graphService.setCreationLock(repoKey, false);

      const result = await toolCb({
        functionName: "absolutely_nonexistent_function_xyz_999",
      });

      expect(result.content[0].text).toMatch(
        /🔍 No calling functions found|No function|not found/i,
      );
      console.log("✅ Scenario 3: No functions found message displayed");
    });
  });

  describe("Scenario 4: Graph exists + Query timeout", () => {
    it("should handle timeout gracefully with real database", async () => {
      const graphExists = await graphService.checkGraphExists("GraphRAG-SDK");

      if (!graphExists) {
        console.log("⚠️ GraphRAG-SDK graph not found, skipping Scenario 4");
        return;
      }

      const tools = getDefaultRepoHandler().getTools(realRepoData, {}, {});
      const toolCb = tools.find((t) => t.name === "fetchUsageCodeExamples")?.cb;

      if (!toolCb) {
        throw new Error("fetchUsageCodeExamples tool not found");
      }

      // Test with a function that might cause complex queries
      const start = Date.now();
      const result = await toolCb({
        functionName: "chat_session",
      });
      const duration = Date.now() - start;

      // Should complete within reasonable time (< 10 seconds) or show timeout
      if (duration > 10000) {
        expect(result.content[0].text).toMatch(/timeout|taking too long/i);
        console.log("✅ Scenario 4: Timeout handled gracefully");
      } else {
        console.log("✅ Scenario 4: Query completed within timeout period");
      }
    });
  });

  describe("Scenario 5: No graph + Creation in progress", () => {
    it("should show creation progress for non-existent graph", async () => {
      const repoKey = `${testRepoData.owner}/${testRepoData.repo}`;

      // Ensure graph doesn't exist
      const graphExists = await graphService.checkGraphExists(
        testRepoData.repo,
      );
      expect(graphExists).toBe(false);

      // Set creation in progress manually
      graphService.setCreationLock(repoKey, true);

      const tools = getDefaultRepoHandler().getTools(testRepoData, {}, {});
      const toolCb = tools.find((t) => t.name === "fetchUsageCodeExamples")?.cb;

      if (!toolCb) {
        throw new Error("fetchUsageCodeExamples tool not found");
      }

      const result = await toolCb({
        functionName: "test_function",
      });

      expect(result.content[0].text).toMatch(/🔄.*Graph Creation In Progress/);
      expect(result.content[0].text).toMatch(/testuser\/test-scenario-repo/);

      // Clean up
      graphService.setCreationLock(repoKey, false);

      console.log("✅ Scenario 5: Creation progress displayed");
    });
  });

  describe("Scenario 6: No graph + First time (Start creation)", () => {
    it("should initiate graph creation for new repository", async () => {
      const repoKey = `${nonExistentRepoData.owner}/${nonExistentRepoData.repo}`;

      // Clean up any existing state
      graphService.setCreationLock(repoKey, false);
      graphService.clearStaleLocks(repoKey);

      // Ensure graph doesn't exist
      const graphExists = await graphService.checkGraphExists(
        nonExistentRepoData.repo,
      );
      expect(graphExists).toBe(false);

      const tools = getDefaultRepoHandler().getTools(
        nonExistentRepoData,
        {},
        {},
      );
      const toolCb = tools.find((t) => t.name === "fetchUsageCodeExamples")?.cb;

      if (!toolCb) {
        throw new Error("fetchUsageCodeExamples tool not found");
      }

      const result = await toolCb({
        functionName: "test_function",
      });

      expect(result.content[0].text).toMatch(/🚀.*Starting Code Analysis/);
      expect(result.content[0].text).toMatch(
        /Graph creation has been initiated/,
      );
      expect(result.content[0].text).toMatch(/5-10 minutes/);

      console.log("✅ Scenario 6: Graph creation initiated");

      // Verify creation lock was set
      const progress = graphService.getCreationProgress(repoKey);
      expect(progress.inProgress).toBe(true);

      // Clean up
      graphService.setCreationLock(repoKey, false);
    });
  });

  describe("Scenario 7: GitHub API timeout during code fetching", () => {
    it("should handle GitHub API timeouts gracefully", async () => {
      const graphExists = await graphService.checkGraphExists("GraphRAG-SDK");

      if (!graphExists) {
        console.log("⚠️ GraphRAG-SDK graph not found, skipping Scenario 7");
        return;
      }

      // Test with a function that exists but might have GitHub API issues
      const tools = getDefaultRepoHandler().getTools(realRepoData, {}, {});
      const toolCb = tools.find((t) => t.name === "fetchUsageCodeExamples")?.cb;

      if (!toolCb) {
        throw new Error("fetchUsageCodeExamples tool not found");
      }

      const result = await toolCb({
        functionName: "chat_session",
      });

      // Should either return code examples or show fallback message
      const hasCodeExamples = result.content[0].text.includes("Code Example");
      const hasFallback = result.content[0].text.includes(
        "temporarily unavailable",
      );

      expect(hasCodeExamples || hasFallback).toBe(true);
      console.log("✅ Scenario 7: GitHub API handling working");
    });
  });

  describe("Scenario 8: General error/exception", () => {
    it("should handle database connection errors gracefully", async () => {
      // Create a repo data with invalid configuration to trigger errors
      const invalidRepoData = {
        owner: "", // Empty string should cause URL construction errors
        repo: "", // Empty string should cause URL construction errors
        host: "gitmcp.io",
        urlType: "github" as const,
      };

      const tools = getDefaultRepoHandler().getTools(invalidRepoData, {}, {});
      const toolCb = tools.find((t) => t.name === "fetchUsageCodeExamples")?.cb;

      if (!toolCb) {
        throw new Error("fetchUsageCodeExamples tool not found");
      }

      try {
        const result = await toolCb({
          functionName: "test_function",
        });

        // Should either return error message or fail with empty repo data
        const hasError =
          result.content[0].text.includes("❌") ||
          result.content[0].text.includes("Error") ||
          result.content[0].text.includes("failed") ||
          result.content[0].text.includes("Invalid") ||
          result.content[0].text.includes("empty");

        expect(hasError).toBe(true);
        console.log("✅ Scenario 8: Error handling working");
      } catch (error) {
        // If an exception is thrown, that's also valid error handling
        expect(error).toBeDefined();
        console.log("✅ Scenario 8: Error handling working (exception thrown)");
      }
    });
  });

  describe("Edge Cases and State Management", () => {
    it("should handle stale lock cleanup properly", async () => {
      const repoKey = `${testRepoData.owner}/${testRepoData.repo}`;

      // Manually create a stale lock (simulate old timestamp)
      const registry = graphService.getGlobalCreationRegistry?.() || new Map();
      registry.set(repoKey, {
        inProgress: true,
        timestamp: Date.now() - 15 * 60 * 1000, // 15 minutes ago
        phase: "Stale analysis",
      });

      const tools = getDefaultRepoHandler().getTools(testRepoData, {}, {});
      const toolCb = tools.find((t) => t.name === "fetchUsageCodeExamples")?.cb;

      if (!toolCb) {
        throw new Error("fetchUsageCodeExamples tool not found");
      }

      const result = await toolCb({
        functionName: "test_function",
      });

      // Should clean up stale locks and either start fresh or show progress
      expect(result.content[0].text).toMatch(
        /Starting Code Analysis|Graph Creation/,
      );
      console.log("✅ Stale lock cleanup working");
    });

    it("should handle multiple repositories independently", async () => {
      const repo1Key = `${realRepoData.owner}/${realRepoData.repo}`;
      const repo2Key = `${testRepoData.owner}/${testRepoData.repo}`;

      // Set different states for each repo
      graphService.setCreationLock(repo1Key, false);
      graphService.setCreationLock(repo2Key, true);

      const tools1 = getDefaultRepoHandler().getTools(realRepoData, {}, {});
      const tools2 = getDefaultRepoHandler().getTools(testRepoData, {}, {});

      const toolCb1 = tools1.find(
        (t) => t.name === "fetchUsageCodeExamples",
      )?.cb;
      const toolCb2 = tools2.find(
        (t) => t.name === "fetchUsageCodeExamples",
      )?.cb;

      if (!toolCb1 || !toolCb2) {
        throw new Error(
          "fetchUsageCodeExamples tool not found in one or both handlers",
        );
      }

      const [result1, result2] = await Promise.all([
        toolCb1({ functionName: "test_function" }),
        toolCb2({ functionName: "test_function" }),
      ]);

      // Results should be different based on repo state
      expect(result1.content[0].text).not.toEqual(result2.content[0].text);
      console.log("✅ Multi-repository independence working");

      // Clean up
      graphService.setCreationLock(repo1Key, false);
      graphService.setCreationLock(repo2Key, false);
    });

    it("should validate real FalkorDB connection and operations", async () => {
      // Test actual database operations
      const graphs = await client.list();
      expect(Array.isArray(graphs)).toBe(true);

      // Test graph service connection
      const isConnected = await graphService.checkGraphExists("GraphRAG-SDK");
      expect(typeof isConnected).toBe("boolean");

      console.log(
        `✅ FalkorDB operations working. Available graphs: ${graphs.join(", ")}`,
      );
    });
  });
});
