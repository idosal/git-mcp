import type { RepoData } from "../../../shared/repoData.js";
import { promises as fs } from "fs";
import path from "path";

export async function fetchNode({
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
  nodeType: string;
  path: string;
  connectedPaths: { name: string; path: string }[];
}> {
  const raw = await graph.query(`MATCH (n {name: '${nodeName}'}) RETURN n`);
  if (!raw?.data?.length) {
    return { nodeName, nodeType: "", path: "", connectedPaths: [] };
  }

  const node = raw.data[0].n;
  const props = node.properties;
  const pathStr = typeof props.path === "string" ? props.path : "";
  const start = typeof props.src_start === "number" ? props.src_start : NaN;

  let connectedPaths: { name: string; path: string }[] = [];
  if (pathStr && !isNaN(start)) {
    const rangeStart = start - 50;
    const rangeEnd = start + 50;
    const connectedRaw = await graph.query(`
      MATCH (m:Function)
        WHERE m.path = '${pathStr}'
          AND m.name <> '${nodeName}'
          AND m.src_start >= ${rangeStart}
          AND m.src_start <= ${rangeEnd}
      RETURN m.name AS name, m.path AS path
      LIMIT ${functionLimit}
    `);

    if (Array.isArray(connectedRaw.data)) {
      connectedPaths = connectedRaw.data.map((r: any) => ({
        name: r.name,
        path: r.path,
      }));
    }
  }

  return {
    nodeName: props.name ?? nodeName,
    nodeType: node.labels?.[0] ?? "",
    path: pathStr,
    connectedPaths,
  };
}
