/**
 * Generates a consistent server name based on repository name
 * @param repo - The repository name
 * @returns A server name for use in MCP clients
 */
export function generateServerName(repo: string | null | undefined): string {
  return repo ? `${repo} Docs` : "MCP Docs";
}
