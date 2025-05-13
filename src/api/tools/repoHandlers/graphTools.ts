import type { RepoData } from "../../../shared/repoData.js";
import { readFile } from "fs/promises";

export async function getFunctionInfo({
  repoData,
  ctx: { graph },
  env,
  nodeName,
  functionLimit = 10,
}: {
  repoData: RepoData;
  ctx: { graph: any };
  env: any;
  nodeName: string;
  functionLimit?: number;
}): Promise<{
  nodeName: string;
  connectedFunctions: { name: string; path: string; code: string }[];
}> {
  const result = await graph.query(`
    MATCH (n:Function {name: '${nodeName}'})
    MATCH (caller:Function)-[r:CALLS]->(n)
    RETURN
      n.name AS nodeName,
      collect({
        name: caller.name,
        path: caller.path,
        line: r.line
      })[0..${functionLimit}] AS connectedFunctions
  `);

  console.log("repoData: ", repoData);

  const row = result?.data?.[0] ?? {};
  const callers = Array.isArray(row.connectedFunctions)
    ? row.connectedFunctions
    : [];

  const connectedFunctions = await Promise.all(
    callers.map(
      async (caller: {
        name: string;
        path: string;
        src_start: number;
        src_end: number;
        line: number;
      }) => {
        const { name, path, src_start, src_end, line } = caller;
        let code;
        try {
          const rel = path.replace(/^.*\/GraphRAG-SDK\//, ""); // gives: graphrag_sdk/agents/kg_agent.py
          const url = `https://raw.githubusercontent.com/FalkorDB/GraphRAG-SDK/main/${rel}`;
          console.log("Fetching from:", url);

          const res = await fetch(url);
          if (!res.ok) throw new Error(`HTTP ${res.status}`);

          const fileContent = await res.text();
          const lines = fileContent.split("\n");
          const center = line + 1;
          const contextStart = Math.max(0, center - 5);
          const contextEnd = center + 6;

          const extracted = lines.slice(contextStart, contextEnd).join("\n");
          code = extracted.trim();
        } catch (e) {
          code = "// Code not available: " + e;
        }

        return { name, path, code };
      },
    ),
  );

  return {
    nodeName: row.nodeName ?? nodeName,
    connectedFunctions,
  };
}
