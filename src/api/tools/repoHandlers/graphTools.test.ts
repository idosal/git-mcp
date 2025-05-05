import { describe, beforeAll, afterAll, it, expect } from "vitest";
import { FalkorDB } from "falkordb";
import { fetchNode } from "./graphTools";

let client: FalkorDB;
let graph: any;

describe("fetchNode", () => {
  beforeAll(async () => {
    client = await FalkorDB.connect({
      socket: { host: "localhost", port: 6379 },
      username: "",
      password: "",
    });
    graph = client.selectGraph("GraphRAG-SDK");
  });

  afterAll(async () => {
    await client.close();
  });

  it("should fetch a node’s path and up to N connected function names + paths", async () => {
    const nodeName = "ask";
    const functionLimit = 2;

    const result = await fetchNode({
      repoData: {} as any,
      ctx: { graph },
      env: {},
      nodeName,
      functionLimit,
    });
    console.log("result", result);

    // Basic shape
    expect(result).toBeDefined();
    expect(result.nodeName).toBe(nodeName);
    expect(typeof result.nodeType).toBe("string");

    // `path` field
    expect(typeof result.path).toBe("string");
    expect(result.path).not.toHaveLength(0);

    // `connectedPaths` array of objects
    expect(Array.isArray(result.connectedPaths)).toBe(true);
    expect(result.connectedPaths.length).toBeLessThanOrEqual(functionLimit);
    result.connectedPaths.forEach((cp) => {
      expect(cp).toHaveProperty("name");
      expect(cp).toHaveProperty("path");
      expect(typeof cp.name).toBe("string");
      expect(typeof cp.path).toBe("string");
      expect(cp.path).toMatch(/\.\w+$/);
    });
  });
});
