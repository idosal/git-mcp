import { describe, beforeAll, afterAll, it, expect } from "vitest";
import { FalkorDB } from "falkordb";
import { getFunctionInfo } from "./graphTools";

let client: FalkorDB;
let graph: any;

const testCases = [
  // {
  //   inputNode: "_create_graph_with_sources",
  //   expectedCallerCount: 1,
  //   expectedCallers: [
  //     {
  //       name: "process_sources",
  //       path: "/Users/naseemali/Desktop/code-graph-backend/repositories/GraphRAG-SDK/graphrag_sdk/kg.py",
  //       contains: "def process_sources",
  //     },
  //   ],
  // },
  {
    inputNode: "chat_session",
    expectedCallerCount: 3,
    expectedCallers: [
      {
        name: "test_movie_actor_queries",
        path: "/Users/naseemali/Desktop/code-graph-backend/repositories/GraphRAG-SDK/tests/test_rag.py",
        contains: "def test_movie_actor_queries",
      },
      {
        name: "test_streaming",
        path: "/Users/naseemali/Desktop/code-graph-backend/repositories/GraphRAG-SDK/tests/test_streaming_response.py",
        contains: "def test_streaming",
      },
      {
        name: "__init__",
        path: "/Users/naseemali/Desktop/code-graph-backend/repositories/GraphRAG-SDK/graphrag_sdk/agents/kg_agent.py",
        contains: "def __init__",
      },
    ],
  },
  {
    inputNode: "save_to_graph",
    expectedCallerCount: 1,
    expectedCallers: [
      {
        name: "__init__",
        path: "/Users/naseemali/Desktop/code-graph-backend/repositories/GraphRAG-SDK/graphrag_sdk/kg.py",
        contains: "def __init__",
      },
    ],
  },
  {
    inputNode: "get_relations_with_label",
    expectedCallerCount: 3,
    expectedCallers: [
      {
        name: "_validate_relation",
        path: "/Users/naseemali/Desktop/code-graph-backend/repositories/GraphRAG-SDK/graphrag_sdk/kg.py",
        contains: "def _validate_relation",
      },
      {
        name: "validate_cypher_relation_directions",
        path: "/Users/naseemali/Desktop/code-graph-backend/repositories/GraphRAG-SDK/graphrag_sdk/helpers.py",
        contains: "def validate_cypher_relation_directions",
      },
      {
        name: "_create_relation",
        path: "/Users/naseemali/Desktop/code-graph-backend/repositories/GraphRAG-SDK/graphrag_sdk/steps/extract_data_step.py",
        contains:
          "def _create_relation(self, graph: Graph, args: dict, ontology: Ontology) -> None:",
      },
    ],
  },
];

describe("getFunctionInfo (parameterized with code)", () => {
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

  testCases.forEach(({ inputNode, expectedCallerCount, expectedCallers }) => {
    it(`should fetch callers of '${inputNode}' and verify code`, async () => {
      const result = await getFunctionInfo({
        repoData: {} as any,
        ctx: { graph },
        env: {},
        nodeName: inputNode,
        functionLimit: 10,
      });

      console.log(result);

      expect(result).toBeDefined();
      expect(result.connectedFunctions.length).toBe(expectedCallerCount);

      expectedCallers.forEach((expected, index) => {
        const actual = result.connectedFunctions[index];
        expect(actual).toBeDefined();
        expect(actual.name).toBe(expected.name);
        expect(actual.path).toBe(expected.path);

        expect(actual.code.length).toBeGreaterThan(10);

        // check that code includes a key line or signature
        if (expected.contains) {
          expect(actual.code).toContain(expected.contains);
        }
      });
    });
  });
});
