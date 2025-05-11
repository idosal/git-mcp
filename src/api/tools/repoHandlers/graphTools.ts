import type { RepoData } from "../../../shared/repoData.js";
import { promises as fs } from "fs";

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
    MATCH (caller:Function)-[:CALLS]->(n)
    RETURN
      n.name AS nodeName,
      collect({
        name: caller.name,
        path: caller.path,
        src_start: caller.src_start,
        src_end: caller.src_end
      })[0..${functionLimit}] AS connectedFunctions
  `);

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
      }) => {
        const { name, path, src_start, src_end } = caller;

        let code = "// Code not available";

        try {
          const fileContent = await fs.readFile(path, "utf-8");
          const lines = fileContent.split("\n");
          const extracted = lines.slice(src_start, src_end).join("\n");
          code = extracted.trim() || code;
        } catch {
          //error message
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
