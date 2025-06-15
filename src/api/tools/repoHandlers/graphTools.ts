import type { RepoData } from "../../../shared/repoData.js";
import { FalkorDB } from "falkordb";

// Configuration for code-graph integration
export interface CodeGraphConfig {
  serverUrl: string;
  serverPort: number;
  authToken: string;
  ignorePatterns: string[];
}

/**
 * Get code-graph configuration from environment variables with fallbacks
 */
export function getCodeGraphConfig(): CodeGraphConfig {
  return {
    serverUrl: process.env.CODE_GRAPH_SERVER_URL || "http://127.0.0.1",
    serverPort: parseInt(process.env.CODE_GRAPH_SERVER_PORT || "5000"),
    authToken: process.env.CODE_GRAPH_AUTH_TOKEN || "secret",
    ignorePatterns: process.env.CODE_GRAPH_IGNORE_PATTERNS
      ? process.env.CODE_GRAPH_IGNORE_PATTERNS.split(",")
      : [
          "./.github",
          "./build",
          "./node_modules",
          "./.git",
          "./.vscode",
          "./__pycache__",
          "./.pytest_cache",
        ],
  };
}

/**
 * Get the full API URL for the code-graph server
 */
export function getCodeGraphApiUrl(): string {
  const config = getCodeGraphConfig();
  return `${config.serverUrl}:${config.serverPort}/analyze_repo`;
}

/**
 * Get the GitHub repository URL for a given repository
 */
export function getGitHubRepoUrl(owner: string, repo: string): string {
  return `https://github.com/${owner}/${repo}`;
}

// Simple in-memory lock for Cloudflare Workers environment (legacy support)
const graphCreationLocks = new Map<string, boolean | number>();

// Global creation registry to track ongoing operations
const CREATION_REGISTRY_KEY = "__graph_creation_registry__";

// Initialize global registry if it doesn't exist
if (!(globalThis as any)[CREATION_REGISTRY_KEY]) {
  (globalThis as any)[CREATION_REGISTRY_KEY] = new Map<
    string,
    {
      inProgress: boolean;
      timestamp: number;
      phase: string;
    }
  >();
}

function getGlobalCreationRegistry(): Map<
  string,
  { inProgress: boolean; timestamp: number; phase: string }
> {
  return (globalThis as any)[CREATION_REGISTRY_KEY];
}

// Export the function so it can be used in DefaultRepoHandler
export { getGlobalCreationRegistry };

/**
 * Create a new FalkorDB connection with standard configuration
 */
export async function createFalkorDBConnection(): Promise<FalkorDB> {
  return await FalkorDB.connect({
    socket: {
      host: "localhost",
      port: 6379,
      noDelay: false,
      keepAlive: false,
    },
  });
}

export class GraphCreationService {
  private client: FalkorDB | null = null;

  async connect() {
    if (!this.client) {
      this.client = await createFalkorDBConnection();
    }
    return this.client;
  }

  async disconnect() {
    if (this.client) {
      await this.client.close();
      this.client = null;
    }
  }

  /**
   * Check if graph exists in FalkorDB
   */
  async checkGraphExists(graphName: string): Promise<boolean> {
    try {
      const client = await this.connect();
      const graphs = await client.list();
      return graphs.includes(graphName);
    } catch (error) {
      console.error(`Error checking graph existence for ${graphName}:`, error);
      return false;
    }
  }

  /**
   * Check if graph creation is in progress
   */
  isCreationInProgress(repoKey: string): boolean {
    const registry = getGlobalCreationRegistry();
    const entry = registry.get(repoKey);

    if (entry && entry.inProgress) {
      const elapsedMs = Date.now() - entry.timestamp;
      const elapsedMinutes = Math.floor(elapsedMs / (1000 * 60));

      // If more than 20 minutes have passed, consider it stale and cleanup
      if (elapsedMinutes > 20) {
        registry.delete(repoKey);
        return false;
      }

      return true;
    }

    return false;
  }

  /**
   * Clear stale locks for a repository to ensure fresh start
   */
  clearStaleLocks(repoKey: string): void {
    const registry = getGlobalCreationRegistry();
    const entry = registry.get(repoKey);

    if (entry) {
      const elapsedMs = Date.now() - entry.timestamp;
      const elapsedMinutes = Math.floor(elapsedMs / (1000 * 60));

      // Clear locks older than 10 minutes to prevent stuck states (reduced from 15)
      if (elapsedMinutes > 10) {
        console.log(
          `[Progress] Cleaning up stale creation entry for ${repoKey} (${elapsedMinutes} minutes old)`,
        );
        registry.delete(repoKey);
        graphCreationLocks.delete(repoKey);
        graphCreationLocks.delete(`${repoKey}_timestamp`);
      }
    }

    // Also clear from legacy system - be more aggressive
    const legacyTimestamp = graphCreationLocks.get(
      `${repoKey}_timestamp`,
    ) as number;
    if (legacyTimestamp) {
      const elapsedMs = Date.now() - legacyTimestamp;
      const elapsedMinutes = Math.floor(elapsedMs / (1000 * 60));

      if (elapsedMinutes > 10) {
        console.log(
          `[Progress] Cleaning up legacy locks for ${repoKey} (${elapsedMinutes} minutes old)`,
        );
        graphCreationLocks.delete(repoKey);
        graphCreationLocks.delete(`${repoKey}_timestamp`);
      }
    }
  }

  /**
   * Set creation lock with enhanced persistence
   */
  setCreationLock(repoKey: string, status: boolean) {
    const registry = getGlobalCreationRegistry();

    if (status) {
      // Starting creation - add to registry
      const existing = registry.get(repoKey);
      const timestamp = existing?.timestamp || Date.now();

      registry.set(repoKey, {
        inProgress: true,
        timestamp: timestamp,
        phase: "Initializing analysis",
      });

      console.log(`[Progress] Set creation lock for ${repoKey} (persistent)`);
    } else {
      // Stopping creation - remove from registry
      registry.delete(repoKey);
      console.log(`[Progress] Cleared creation lock for ${repoKey}`);
    }

    // Also update legacy system for backward compatibility
    graphCreationLocks.set(repoKey, status);
    if (status && !graphCreationLocks.has(`${repoKey}_timestamp`)) {
      graphCreationLocks.set(`${repoKey}_timestamp`, Date.now());
    }
  }

  /**
   * Start graph creation in background without blocking - fire and forget
   */
  async startBackgroundCreation(repoData: RepoData): Promise<void> {
    const repoKey = `${repoData.owner}/${repoData.repo}`;

    // Set creation lock immediately
    this.setCreationLock(repoKey, true);

    // Store creation timestamp for progress tracking
    const creationTimestamp = Date.now();
    graphCreationLocks.set(`${repoKey}_timestamp`, creationTimestamp);

    console.log(`[Background] Starting graph creation for ${repoKey}`);

    try {
      const graphName = repoData.repo!;

      // Double-check if graph already exists
      if (await this.checkGraphExists(graphName)) {
        console.log(
          `[Background] Graph ${graphName} already exists, skipping creation`,
        );
        return;
      }

      // Use configuration-based GitHub URL and API endpoint
      const config = getCodeGraphConfig();
      const repoUrl = getGitHubRepoUrl(repoData.owner!, repoData.repo!);
      const apiUrl = getCodeGraphApiUrl();

      console.log(
        `[Background] Creating graph for ${repoKey} using GitHub URL: ${repoUrl}`,
      );
      console.log(`[Background] API URL: ${apiUrl}`);

      const requestBody = {
        repo_url: repoUrl,
        ignore: config.ignorePatterns,
      };

      // Make the actual API request to code-graph backend
      const response = await fetch(apiUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: config.authToken,
        },
        body: JSON.stringify(requestBody),
        // Use shorter timeout for immediate execution
        signal: AbortSignal.timeout(10 * 60 * 1000), // 10 minutes
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error(
          `[Background] API request failed: ${response.status} ${response.statusText} - ${errorText}`,
        );
        throw new Error(
          `API request failed: ${response.status} ${response.statusText} - ${errorText}`,
        );
      }

      const result = await response.text();
      console.log(
        `[Background] Graph creation API response for ${repoKey}:`,
        result,
      );

      // Set a shorter polling interval since we know the backend is working
      let attempts = 0;
      const maxAttempts = 15; // 15 attempts over ~7.5 minutes

      while (attempts < maxAttempts) {
        attempts++;

        // Wait 30 seconds between checks
        await new Promise((resolve) => setTimeout(resolve, 30 * 1000));

        console.log(
          `[Background] Checking if graph ${graphName} exists (attempt ${attempts}/${maxAttempts})`,
        );

        const graphExists = await this.checkGraphExists(graphName);
        if (graphExists) {
          console.log(
            `[Background] Graph creation completed successfully for ${repoKey} after ${attempts} checks`,
          );
          return;
        }
      }

      console.warn(
        `[Background] Graph ${graphName} still not detected after ${maxAttempts} attempts`,
      );
    } catch (error) {
      console.error(`[Background] Error creating graph for ${repoKey}:`, error);

      if (error instanceof Error && error.name === "TimeoutError") {
        console.error(`[Background] Graph creation for ${repoKey} timed out`);
      }
    } finally {
      // Clean up locks after completion or failure
      setTimeout(
        () => {
          this.setCreationLock(repoKey, false);
          graphCreationLocks.delete(`${repoKey}_timestamp`);
          console.log(`[Background] Cleaned up locks for ${repoKey}`);
        },
        2 * 60 * 1000,
      ); // 2 minutes delay for final cleanup
    }
  }

  /**
   * Get creation progress information with simplified estimates
   */
  getCreationProgress(repoKey: string): {
    inProgress: boolean;
    elapsedMinutes: number;
    estimatedRemaining: string;
    phase: string;
  } {
    const registry = getGlobalCreationRegistry();
    const entry = registry.get(repoKey);

    if (entry && entry.inProgress) {
      const elapsedMs = Date.now() - entry.timestamp;
      const elapsedMinutes = Math.floor(elapsedMs / (1000 * 60));

      // If more than 20 minutes have passed, consider it stale and cleanup
      if (elapsedMinutes > 20) {
        console.log(
          `[Progress] Cleaning up stale progress entry for ${repoKey} (${elapsedMinutes} minutes old)`,
        );
        registry.delete(repoKey);
        return {
          inProgress: false,
          elapsedMinutes: 0,
          estimatedRemaining: "N/A",
          phase: "Complete",
        };
      }

      // Simplified progress tracking
      const phase =
        elapsedMinutes < 10 ? "Analyzing repository" : "Completing analysis";
      const estimatedRemaining =
        elapsedMinutes < 10 ? "5-10 minutes" : "Should complete soon";

      console.log(
        `[Progress] ${repoKey}: ${elapsedMinutes}min elapsed, phase: ${phase}`,
      );
      return { inProgress: true, elapsedMinutes, estimatedRemaining, phase };
    }

    return {
      inProgress: false,
      elapsedMinutes: 0,
      estimatedRemaining: "N/A",
      phase: "Complete",
    };
  }
}

// Singleton instance
let graphService: GraphCreationService | null = null;

export function getGraphService(): GraphCreationService {
  if (!graphService) {
    graphService = new GraphCreationService();
  }
  return graphService;
}

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
  connectedFunctions: {
    name: string;
    path: string;
    line: number;
    code: string;
  }[];
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

  const row = result?.data?.[0] ?? {};
  const callers = Array.isArray(row.connectedFunctions)
    ? row.connectedFunctions
    : [];

  const connectedFunctions = callers.map(
    (caller: { name: string; path: string; line: number }) => ({
      name: caller.name,
      path: caller.path,
      line: caller.line,
      code: "", // Code fetching handled by DefaultRepoHandler
    }),
  );

  return {
    nodeName: row.nodeName ?? nodeName,
    connectedFunctions,
  };
}
