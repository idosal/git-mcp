import { describe, beforeAll, afterAll, it, expect } from 'vitest';
import { FalkorDB } from 'falkordb';
import { fetchNode } from './graphTools';

let client: FalkorDB;
let graph: any;

describe('fetchNode', () => {
  beforeAll(async () => {
    client = await FalkorDB.connect({
      socket: { host: 'localhost', port: 6379 },
      username: '',
      password: '',
    });
    graph = client.selectGraph('GraphRAG-SDK');
  });

  afterAll(async () => {
    await client.close();
  });

  it('should fetch a function and related functions', async () => {
    const nodeName = 'ask';
    const limit = 200;
    const functionLimit = 2;

    const result = await fetchNode({
      repoData: {} as any,
      ctx: { graph },
      env: {},
      nodeName,
      limit,
      functionLimit,
    });

    console.log('Result:', result);

    expect(result).toBeDefined();
    expect(result.nodeName).toBe(nodeName);
    expect(typeof result.nodeType).toBe('string');
    expect(typeof result.code).toBe('string');
    expect(result.code?.length).toBeLessThanOrEqual(limit);

    if (functionLimit > 0 && Array.isArray(result.connected)) {
      expect(result.connected.length).toBeLessThanOrEqual(functionLimit);
      result.connected.forEach((conn) => {
        expect(conn).toHaveProperty('name');
        expect(conn).toHaveProperty('type');
        expect(typeof conn.name).toBe('string');
        expect(typeof conn.type).toBe('string');
      });
    }
  });
});
