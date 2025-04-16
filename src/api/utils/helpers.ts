/**
 * Format search results into a readable text format
 * Ensures each documentation entry is properly separated
 * @param results - Array of search results
 * @param query - The original search query
 * @returns Formatted text with search results
 */
export function formatSearchResults(
  results: Array<{ chunk: string; score: number }>,
  query: string,
): string {
  let output = `### Search Results for: "${query}"\n\n`;

  if (results.length === 0) {
    return output + "No results found.";
  }

  // Array to keep track of already displayed entries to avoid duplicates
  const displayedEntries = new Set<string>();
  let resultCount = 0;

  results.forEach((result, index) => {
    // Check if this chunk contains multiple documentation entries
    // Documentation entries typically follow the pattern [Title](URL): Description
    const entryPattern = /\[.*?\]\(.*?\):\s*.*?(?=\n\n\[|$)/gs;
    const entries = result.chunk.match(entryPattern);

    if (entries && entries.length > 1) {
      // This chunk contains multiple entries, display each one separately
      entries.forEach((entry, entryIndex) => {
        // Skip duplicate entries
        const normalizedEntry = entry.trim();
        if (displayedEntries.has(normalizedEntry)) {
          return;
        }

        resultCount++;
        displayedEntries.add(normalizedEntry);

        // Add header context if available
        let headerContext = "";
        const headerMatch = result.chunk.match(/^(#+\s+.*?)(?=\n\n)/);
        if (headerMatch) {
          headerContext = headerMatch[1] + "\n\n";
        }

        output += `#### Result ${resultCount} (Score: ${result.score.toFixed(
          2,
        )})\n\n${headerContext}${normalizedEntry}\n\n`;

        // Add separator if not the last entry
        if (index < results.length - 1 || entryIndex < entries.length - 1) {
          output += "---\n\n";
        }
      });
    } else {
      // Single entry or non-standard format, display the whole chunk
      resultCount++;

      // Normalize the chunk to avoid duplicates
      const normalizedChunk = result.chunk.trim();
      if (displayedEntries.has(normalizedChunk)) {
        return;
      }

      displayedEntries.add(normalizedChunk);

      output += `#### Result ${resultCount} (Score: ${result.score.toFixed(
        2,
      )})\n\n${normalizedChunk}\n\n`;

      // Add separator if not the last result
      if (index < results.length - 1) {
        output += "---\n\n";
      }
    }
  });

  return output;
}

// Helper: fetch a file from a URL.
export async function fetchFile(url: string): Promise<string | null> {
  try {
    const response = await fetch(url);
    return response.ok ? await response.text() : null;
  } catch {
    return null;
  }
}
