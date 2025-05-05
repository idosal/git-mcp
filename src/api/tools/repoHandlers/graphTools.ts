import type { RepoData } from "../../../shared/repoData.js";
import { promises as fs } from 'fs';
import path from 'path';

export async function fetchNode({
  repoData,
  ctx: { graph },
  env,
  nodeName,
  limit = 200,
  functionLimit = 0,
}: {
  repoData: RepoData;
  ctx: { graph: any };
  env: any;
  nodeName: string;
  limit?: number;
  functionLimit?: number;
}): Promise<{
  nodeName: string;
  nodeType: string;
  code?: string;
  connected?: { name: string; type: string }[];
}> {
  const raw = await graph.query(`MATCH (n {name: '${nodeName}'}) RETURN n`);
  if (!raw?.data?.length) {
    return { nodeName, nodeType: '', code: '' };
  }

  const node = raw.data[0].n;
  const props = node.properties;
  let code: string = '';

  if (props.doc != null) {
    code = String(props.doc).slice(0, limit);
  } else if (
    props.path &&
    typeof props.src_start === 'number' &&
    typeof props.src_end === 'number'
  ) {
    try {
      const absPath = path.resolve(process.cwd(), props.path);
      const content = await fs.readFile(absPath, 'utf-8');
      code = content.slice(props.src_start, props.src_end).slice(0, limit);
    } catch {
      code = '';
    }
  }

  let connected: { name: string; type: string }[] = [];
  if (props.path && typeof props.src_start === 'number') {
    const rangeStart = props.src_start - 50;
    const rangeEnd = props.src_start + 50;

    const connectedRaw = await graph.query(
      `MATCH (m:Function) WHERE m.path = '${props.path}' AND m.name <> '${nodeName}' AND m.src_start >= ${rangeStart} AND m.src_start <= ${rangeEnd} RETURN m.name AS name, labels(m)[0] AS type LIMIT ${functionLimit}`
    );

    if (Array.isArray(connectedRaw?.data)) {
      connected = connectedRaw.data.map((row: any) => ({
        name: row.name,
        type: row.type,
      }));
    }
  }

  return {
    nodeName: props.name ?? nodeName,
    nodeType: node.labels?.[0] ?? '',
    code,
    connected,
  };
}
  
