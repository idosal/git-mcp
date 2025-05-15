import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { FalkorDB } from "falkordb";
import { getDefaultRepoHandler } from "./DefaultRepoHandler";

let client: FalkorDB;
let graph: any;

const repoData = {
  owner: "FalkorDB",
  repo: "GraphRAG-SDK",
  root: "/tmp/gitmcp/FalkorDB/GraphRAG-SDK",
  host: "localhost:5173",
  urlType: "github" as const, // ✅ forces it to type "github" instead of string
};

describe("fetchUsageCodeExamples tool", () => {
  let toolCb: any;

  beforeAll(async () => {
    client = await FalkorDB.connect({
      socket: { host: "localhost", port: 6379 },
    });
    graph = client.selectGraph(repoData.repo);

    const tools = getDefaultRepoHandler().getTools(repoData, {}, { graph });

    toolCb = tools.find((t) => t.name === "fetchUsageCodeExamples")?.cb;
    if (!toolCb) throw new Error("Tool not found");
  });

  afterAll(async () => {
    await client.close();
  });

  it("returns code snippets for 'chat_session'", async () => {
    const result = await toolCb({
      functionName: "chat_session",
      repoData,
      env: {},
      ctx: { graph },
    });

    expect(result).toBeDefined();
    expect(result.content[0].text).toContain("Code Example Results");
    expect(result.content[0].text).toContain("chat_session");
  });

  it("returns code snippets for 'save_to_graph'", async () => {
    const result = await toolCb({
      functionName: "save_to_graph",
      repoData,
      env: {},
      ctx: { graph },
    });

    expect(result).toBeDefined();
    expect(result.content[0].text).toContain("Code Example Results");
    expect(result.content[0].text).toContain("save_to_graph");
  });

  it("returns fallback message when function not found", async () => {
    const result = await toolCb({
      functionName: "this_function_does_not_exist",
      repoData,
      env: {},
      ctx: { graph },
    });

    expect(result.content[0].text).toBe(
      'No calling functions found for "this_function_does_not_exist".',
    );
  });
});
