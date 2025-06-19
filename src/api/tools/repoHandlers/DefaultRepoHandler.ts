import {
  fetchDocumentation,
  searchRepositoryDocumentation,
  searchRepositoryCode,
  fetchUrlContent,
  generateFetchToolName,
  generateFetchToolDescription,
  generateSearchToolName,
  generateSearchToolDescription,
  generateCodeSearchToolName,
  generateCodeSearchToolDescription,
} from "../commonTools.js";
import { z } from "zod";
import type { RepoData } from "../../../shared/repoData.js";
import type { RepoHandler, Tool } from "./RepoHandler.js";
import {
  getFunctionInfo,
  getGraphService,
  createFalkorDBConnection,
  getCodeGraphConfig,
  getGitHubRepoUrl,
  getCodeGraphApiUrl,
  getGlobalCreationRegistry,
} from "./graphTools.js";
import { fetchFileFromGitHub, getRepoBranch } from "../../utils/github.js";

class DefaultRepoHandler implements RepoHandler {
  name = "default";
  getTools(repoData: RepoData, env: any, ctx: any): Array<Tool> {
    // Generate a dynamic description based on the URL
    const fetchToolName = generateFetchToolName(repoData);
    const fetchToolDescription = generateFetchToolDescription(repoData);
    const searchToolName = generateSearchToolName(repoData);
    const searchToolDescription = generateSearchToolDescription(repoData);
    const codeSearchToolName = generateCodeSearchToolName(repoData);
    const codeSearchToolDescription =
      generateCodeSearchToolDescription(repoData);

    return [
      {
        name: fetchToolName,
        description: fetchToolDescription,
        paramsSchema: z.union([z.object({}), z.null()]),
        cb: async () => {
          return fetchDocumentation({ repoData, env, ctx });
        },
      },
      {
        name: searchToolName,
        description: searchToolDescription,
        paramsSchema: {
          query: z
            .string()
            .describe("The search query to find relevant documentation"),
        },
        cb: async ({ query }) => {
          return searchRepositoryDocumentation({
            repoData,
            query,
            env,
            ctx,
          });
        },
      },
      {
        name: codeSearchToolName,
        description: codeSearchToolDescription,
        paramsSchema: {
          query: z
            .string()
            .describe("The search query to find relevant code files"),
          page: z
            .number()
            .optional()
            .describe(
              "Page number to retrieve (starting from 1). Each page contains 30 results.",
            ),
        },
        cb: async ({ query, page }) => {
          return searchRepositoryCode({
            repoData,
            query,
            page,
            env,
            ctx,
          });
        },
      },
      {
        name: "fetchUsageCodeExamples",
        description:
          "Fetch code examples that use the given function. Use it when the user asks about code example or how to use his function. Returns code snippets that demonstrate how to calls this function.",
        paramsSchema: {
          functionName: z
            .string()
            .describe("Name of the function to find who calls it"),
          // limit: z.number().optional().default(10).describe("Max number of calling functions to return")
        },
        cb: async ({ functionName, limit = 10 }) => {
          const graphService = getGraphService();

          try {
            // Input validation - check for empty or invalid repo data
            if (
              !repoData.owner ||
              !repoData.repo ||
              repoData.owner.trim() === "" ||
              repoData.repo.trim() === ""
            ) {
              return {
                content: [
                  {
                    type: "text",
                    text: `❌ Error: Invalid repository data. Owner and repository name cannot be empty.`,
                  },
                ],
              };
            }

            const graphName = repoData.repo!;
            const repoKey = `${repoData.owner}/${repoData.repo}`;

            // Simple check: does the graph exist?
            const graphExists = await graphService.checkGraphExists(graphName);

            if (graphExists) {
              // Graph exists - proceed with normal functionality with timeout
              console.log(
                `Graph ${graphName} exists, proceeding with code examples search`,
              );

              try {
                // Add simple timeout to prevent infinite loading
                const result = await Promise.race([
                  // The actual graph operation
                  (async () => {
                    const client = await createFalkorDBConnection();

                    try {
                      const graph = client.selectGraph(graphName);

                      // Use the centralized function from graphTools
                      const result = await getFunctionInfo({
                        repoData,
                        ctx: { graph },
                        env,
                        nodeName: functionName,
                        functionLimit: limit,
                      });

                      const callers = result.connectedFunctions;

                      if (!callers.length) {
                        // Before showing "no functions found", check if creation is still in progress
                        const creationProgress =
                          graphService.getCreationProgress(repoKey);
                        if (creationProgress.inProgress) {
                          return {
                            content: [
                              {
                                type: "text",
                                text: `🔄 **Graph Creation Still In Progress for ${repoKey}**\n\n⏱️ **Current Status**: ${creationProgress.phase}\n📊 **Elapsed Time**: ${creationProgress.elapsedMinutes} minutes\n⌛ **Estimated Remaining**: ${creationProgress.estimatedRemaining}\n\n🔄 **Please wait a bit longer and try again:**\n"Show me code examples of how to use the ${functionName} function"\n\n💡 *The graph analysis is still building function relationships. Once complete, you'll get detailed code examples.*`,
                              },
                            ],
                          };
                        }

                        return {
                          content: [
                            {
                              type: "text",
                              text: `🔍 No calling functions found for "${functionName}".\n\nThis could mean:\n1. The function doesn't exist in the codebase\n2. No other functions call this function\n3. The function name might be misspelled\n4. The function might be called dynamically (not statically analyzable)\n\nTry searching for similar function names or check if the function exists in the repository.`,
                            },
                          ],
                        };
                      }

                      // Get the default branch for the repository
                      const defaultBranch = await getRepoBranch(
                        repoData.owner!,
                        repoData.repo!,
                        env,
                      );

                      // Process each caller and get actual code with timeout protection
                      const codeExamples = await Promise.all(
                        callers.map(
                          async (
                            caller: {
                              name: string;
                              path: string;
                              line: number;
                            },
                            index: number,
                          ) => {
                            const { name, path, line } = caller;

                            // Extract relative path from the database path
                            const pathMatch = path.match(
                              /.*\/repositories\/[^\/]+\/(.+)$/,
                            );
                            const relativePath = pathMatch
                              ? pathMatch[1]
                              : path.split("/").slice(-2).join("/");

                            let codeSnippet = "";
                            try {
                              // Add timeout to prevent hanging on GitHub API calls
                              const timeoutPromise = new Promise((_, reject) =>
                                setTimeout(
                                  () => reject(new Error("GitHub API timeout")),
                                  5000,
                                ),
                              );

                              const fetchPromise = fetchFileFromGitHub(
                                repoData.owner!,
                                repoData.repo!,
                                defaultBranch,
                                relativePath,
                                env,
                                false,
                              );

                              const fileContent = await Promise.race([
                                fetchPromise,
                                timeoutPromise,
                              ]);

                              if (
                                fileContent &&
                                typeof fileContent === "string"
                              ) {
                                const lines = fileContent.split("\n");
                                const centerLine = line - 1; // Convert to 0-based index
                                const startLine = Math.max(0, centerLine - 5);
                                const endLine = Math.min(
                                  lines.length - 1,
                                  centerLine + 5,
                                );

                                const snippet = lines.slice(
                                  startLine,
                                  endLine + 1,
                                );
                                codeSnippet = snippet
                                  .map(
                                    (codeLine: string, lineIndex: number) => {
                                      const actualLineNumber =
                                        startLine + lineIndex + 1;
                                      const marker =
                                        actualLineNumber === line
                                          ? ">>>"
                                          : "   ";
                                      return `${marker} ${actualLineNumber.toString().padStart(3)}: ${codeLine}`;
                                    },
                                  )
                                  .join("\n");
                              } else {
                                throw new Error("File content not found");
                              }
                            } catch (error) {
                              // Fallback to showing just the function info without code content
                              codeSnippet = `Function: ${name}\nFile: ${relativePath}:${line}\nCalls: ${functionName}\n\n(Code content temporarily unavailable)`;
                            }

                            return `## Code Example ${index + 1}: ${name}

                            File: ${relativePath}:${line}
                            Calls: ${functionName}

                            \`\`\`
                            ${codeSnippet}
                            \`\`\`
                            `;
                          },
                        ),
                      );

                      return {
                        content: [
                          {
                            type: "text",
                            text: `📋 Code Example Results for "${functionName}" function:\n\nFound ${callers.length} function${callers.length === 1 ? "" : "s"} that call "${functionName}":\n\n${codeExamples.join("\n\n")}`,
                          },
                        ],
                      };
                    } finally {
                      await client.close();
                    }
                  })(),
                  // 8 second timeout
                  new Promise((_, reject) =>
                    setTimeout(
                      () => reject(new Error("Operation timeout")),
                      8000,
                    ),
                  ),
                ]);

                return result;
              } catch (error) {
                console.error(`Graph query failed for ${functionName}:`, error);
                return {
                  content: [
                    {
                      type: "text",
                      text: `⏱️ **Search Timeout**\n\nThe search for "${functionName}" is taking too long. Please try again.\n\n**Possible causes:**\n• Large repository analysis in progress\n• Database temporarily busy\n• Complex query processing\n\n**Try again in a moment!**`,
                    },
                  ],
                };
              }
            } else {
              // Phase 2: Graph doesn't exist - check creation status and provide immediate feedback
              console.log(
                `Graph ${graphName} not found. Checking creation status...`,
              );

              // FIRST: Force clear any stale locks (older than 20 minutes) to prevent stuck states
              graphService.clearStaleLocks(repoKey);

              // SECOND: If locks are older than 5 minutes, force clear them to allow fresh requests
              const progress = graphService.getCreationProgress(repoKey);
              if (progress.inProgress && progress.elapsedMinutes >= 5) {
                console.log(
                  `[Debug] Forcing cleanup of ${repoKey} creation locks after ${progress.elapsedMinutes} minutes`,
                );
                graphService.setCreationLock(repoKey, false);
                // Force clear all related locks
                const registry = getGlobalCreationRegistry();
                registry.delete(repoKey);
              }

              // THEN: Check if creation is actually in progress (after clearing stale locks)
              const finalProgress = graphService.getCreationProgress(repoKey);
              console.log(
                `[Debug] Progress check for ${repoKey} after clearing stale locks:`,
                finalProgress,
              );

              if (finalProgress.inProgress) {
                // Creation is genuinely in progress - show progress and ask to wait
                console.log(
                  `[Debug] Creation in progress for ${repoKey}, showing progress`,
                );
                return {
                  content: [
                    {
                      type: "text",
                      text: `🔄 **Graph Creation In Progress for ${repoKey}**\n\n⏱️ **Current Status**: ${finalProgress.phase}\n📊 **Elapsed Time**: ${finalProgress.elapsedMinutes} minutes\n⌛ **Estimated Remaining**: ${finalProgress.estimatedRemaining}\n\n🔄 **Please wait and try your question again in a few minutes:**\n"Show me code examples of how to use the ${functionName} function"\n\n💡 *The system is analyzing the repository to build a knowledge graph of function relationships. This process takes time but enables precise code example searches.*`,
                    },
                  ],
                };
              } else {
                // No creation in progress - start it now and return immediate response
                console.log(
                  `Starting graph creation for ${repoKey} in background...`,
                );

                // Set creation lock immediately
                graphService.setCreationLock(repoKey, true);

                // Get configuration for the API call
                const config = getCodeGraphConfig();
                const repoUrl = getGitHubRepoUrl(
                  repoData.owner!,
                  repoData.repo!,
                );
                const apiUrl = getCodeGraphApiUrl();

                const requestBody = {
                  repo_url: repoUrl,
                  ignore: config.ignorePatterns,
                };

                console.log(`[Immediate] Making API request to ${apiUrl}`);
                console.log(
                  `[Immediate] Request body:`,
                  JSON.stringify(requestBody),
                );

                // Make the API call with a very short timeout to ensure it fires but doesn't block
                try {
                  fetch(apiUrl, {
                    method: "POST",
                    headers: {
                      "Content-Type": "application/json",
                      Authorization: config.authToken,
                    },
                    body: JSON.stringify(requestBody),
                    signal: AbortSignal.timeout(5000), // Short 5 second timeout
                  })
                    .then((response) => {
                      if (response.ok) {
                        console.log(
                          `[Immediate] API request successful for ${repoKey}`,
                        );
                      } else {
                        console.error(
                          `[Immediate] API request failed: ${response.status} ${response.statusText}`,
                        );
                      }
                    })
                    .catch((error) => {
                      console.error(
                        `[Immediate] API request error for ${repoKey}:`,
                        error,
                      );
                    });
                } catch (error) {
                  console.error(
                    `[Immediate] Failed to initiate API request:`,
                    error,
                  );
                }

                return {
                  content: [
                    {
                      type: "text",
                      text: `🚀 **Starting Code Analysis for ${repoKey}**\n\n✅ **Graph creation has been initiated!** The system is now analyzing the repository to build a knowledge graph of function relationships.\n\n⏱️ **Estimated Time**: 5-10 minutes\n📊 **What's happening**: \n  • Scanning repository structure\n  • Analyzing function definitions\n  • Mapping function call relationships\n  • Building searchable graph database\n\n🔄 **Please ask your question again in about 5-10 minutes:**\n"Show me code examples of how to use the ${functionName} function"\n\n💡 *This one-time setup enables fast and precise code example searches for this repository!*`,
                    },
                  ],
                };
              }
            }
          } catch (error) {
            console.error("Error in fetchUsageCodeExamples:", error);
            return {
              content: [
                {
                  type: "text",
                  text: `❌ Error processing code examples for "${functionName}": ${error instanceof Error ? error.message : "Unknown error"}`,
                },
              ],
            };
          } finally {
            // Clean up the service connection
            await graphService.disconnect();
          }
        },
      },
    ];
  }

  async fetchDocumentation({
    repoData,
    env,
    ctx,
  }: {
    repoData: RepoData;
    env: Env;
    ctx: any;
  }): Promise<{
    fileUsed: string;
    content: { type: "text"; text: string }[];
  }> {
    return await fetchDocumentation({ repoData, env, ctx });
  }

  async searchRepositoryDocumentation({
    repoData,
    query,
    env,
    ctx,
  }: {
    repoData: RepoData;
    query: string;
    env: Env;
    ctx: any;
  }): Promise<{
    searchQuery: string;
    content: { type: "text"; text: string }[];
  }> {
    return await searchRepositoryDocumentation({
      repoData,
      query,
      env,
      ctx,
    });
  }
}

let defaultRepoHandler: DefaultRepoHandler;
export function getDefaultRepoHandler(): DefaultRepoHandler {
  if (!defaultRepoHandler) {
    defaultRepoHandler = new DefaultRepoHandler();
  }
  return defaultRepoHandler;
}
