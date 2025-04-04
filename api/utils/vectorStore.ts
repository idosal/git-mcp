import { Index } from "@upstash/vector";

// Define a generic Dict type since we can't import it directly
type Dict = { [key: string]: any };

// Initialize Upstash Vector client - single index
let vector: Index;
if (process.env.UPSTASH_VECTOR_REST_TOKEN) {
  vector = new Index({
    url: process.env.UPSTASH_VECTOR_REST_URL,
    token: process.env.UPSTASH_VECTOR_REST_TOKEN,
  });
}

// TTL for vector entries in seconds (1 day)
const VECTOR_TTL = 60 * 60 * 24 * 1;

/**
 * Generate a vector ID for a specific document chunk
 * @param owner - Repository owner
 * @param repo - Repository name
 * @param chunkIndex - Index of the chunk
 * @returns Unique ID for the vector
 */
export function getVectorId(
  owner: string,
  repo: string,
  chunkIndex: number,
): string {
  return `repo:${owner}:${repo}:chunk:${chunkIndex}`;
}

/**
 * Get simple embeddings for text with improved topical differentiation
 * In a production environment, you would use a proper embedding service like OpenAI
 * @param text - Text to generate embeddings for
 * @returns Vector embedding (simplified)
 */
export async function getEmbeddings(text: string): Promise<number[]> {
  // This is an improved embedding function that creates a better vector representation
  // Still simple but designed to create more topical differentiation

  // Create a vector with 1024 dimensions to match Upstash Vector requirements
  const view = new Float32Array(1024);

  // Extract key terms and topics from the text
  const keywordExtraction = extractKeywords(text);

  // Use a more sophisticated hash function that weights important terms
  const termWeights = keywordExtraction.reduce(
    (acc, item) => {
      acc[item.term] = item.score;
      return acc;
    },
    {} as { [key: string]: number },
  );

  // Fill the vector with values based on term importance and positions
  const terms = Object.keys(termWeights);

  // Fill base vector with simple hash
  for (let i = 0; i < view.length; i++) {
    // Simple hash function for demo purposes
    let hash = 0;
    for (let j = 0; j < text.length; j += 10) {
      // Sample text at intervals
      hash = (hash << 5) - hash + text.charCodeAt(j) + i;
      hash = hash & hash; // Convert to 32bit integer
    }
    // Normalize between -0.5 and 0.5 (base values)
    view[i] = (hash % 100) / 200;
  }

  // Enhance with keyword features
  for (const term of terms) {
    // Use term to seed a portion of the vector
    const weight = termWeights[term];
    const termHash = simpleHash(term);
    const startPos = termHash % 900; // Avoid last section

    // Enhance specific positions based on term
    for (let i = 0; i < Math.min(term.length * 4, 50); i++) {
      const pos = (startPos + i * 3) % 900;
      // Add weighted value based on term importance
      view[pos] += weight * 0.5 * (Math.sin(termHash + i) * 0.5 + 0.5);
    }
  }

  // Normalize vector to unit length (important for cosine similarity)
  normalizeVector(view);

  return Array.from(view);
}

/**
 * Extract keywords and their importance from text
 */
function extractKeywords(text: string): Array<{ term: string; score: number }> {
  const results: Array<{ term: string; score: number }> = [];
  const words = text
    .toLowerCase()
    .split(/\W+/)
    .filter((w) => w.length > 3);

  // Count word frequencies
  const wordCounts: { [key: string]: number } = {};
  for (const word of words) {
    wordCounts[word] = (wordCounts[word] || 0) + 1;
  }

  // Find interesting terms (high frequency or within heading patterns)
  const headings = text.match(/#{1,6}\s+([^\n]+)/g) || [];
  const headingTerms = new Set<string>();

  // Extract terms from headings with higher weight
  for (const heading of headings) {
    const cleanHeading = heading.replace(/^#+\s+/, "").toLowerCase();
    const terms = cleanHeading.split(/\W+/).filter((w) => w.length > 3);
    terms.forEach((t) => headingTerms.add(t));
  }

  // Calculate term scores based on frequency and position
  const totalWords = words.length;

  for (const word in wordCounts) {
    // Skip common words or very rare words
    if (commonWords.has(word) || wordCounts[word] < 2) continue;

    // Calculate score based on frequency
    let score = wordCounts[word] / totalWords;

    // Boost score for terms in headings
    if (headingTerms.has(word)) {
      score *= 3;
    }

    // Boost for terms in the first paragraph (likely important)
    const firstPara = text.split("\n\n")[0].toLowerCase();
    if (firstPara.includes(word)) {
      score *= 1.5;
    }

    results.push({ term: word, score });
  }

  // Sort by score and take top 20
  results.sort((a, b) => b.score - a.score);
  return results.slice(0, 20);
}

/**
 * Normalize a vector to unit length
 */
function normalizeVector(vector: Float32Array): void {
  // Calculate magnitude
  let magnitude = 0;
  for (let i = 0; i < vector.length; i++) {
    magnitude += vector[i] * vector[i];
  }
  magnitude = Math.sqrt(magnitude);

  // Normalize if magnitude isn't zero
  if (magnitude > 0) {
    for (let i = 0; i < vector.length; i++) {
      vector[i] = vector[i] / magnitude;
    }
  }
}

/**
 * Simple string hash function
 */
function simpleHash(str: string): number {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = (hash << 5) - hash + str.charCodeAt(i);
    hash = hash & hash; // Convert to 32bit integer
  }
  return Math.abs(hash);
}

/**
 * Common English words to filter out
 */
const commonWords = new Set([
  "the",
  "and",
  "that",
  "have",
  "for",
  "not",
  "with",
  "you",
  "this",
  "but",
  "from",
  "they",
  "would",
  "there",
  "their",
  "what",
  "about",
  "which",
  "when",
  "will",
  "there",
  "their",
  "your",
  "some",
  "them",
  "other",
  "than",
  "then",
  "into",
  "could",
  "because",
  "been",
  "more",
  "these",
  "those",
  "only",
]);

/**
 * Specialized chunker for README files that preserves heading context with content
 * Ensures logical paragraph groups and sections remain coherent
 * @param text - README text in markdown format
 * @param fileName - Optional file name to determine special chunking behavior
 * @returns Array of text chunks with preserved structure
 */
export function chunkReadme(text: string, fileName?: string): string[] {
  // Check if this appears to be a README format
  const hasMultipleHeadings = (text.match(/^#+\s+.+/gm) || []).length > 1;
  const hasCodeBlocks = text.includes("```");
  const isReadmeLike =
    hasMultipleHeadings &&
    (hasCodeBlocks || text.includes("* ") || text.includes("- "));

  // If not README-like, use the regular chunking
  if (!isReadmeLike) {
    return chunkText(text);
  }

  // Check if this is a special case file (like llms.txt) that needs list-item level chunking
  const isSpecialListFile = fileName?.toLowerCase().includes("llms.txt");

  // Track headers and their content
  interface HeaderSection {
    level: number;
    title: string;
    content: string;
    lineIndex: number;
  }

  const sections: HeaderSection[] = [];
  let currentSection: HeaderSection | null = null;
  let mainHeaderContent = "";
  let mainTitle = "";

  // Helper function to detect badge lines (markdown image links with badge URLs)
  function isBadgeLine(line: string): boolean {
    // Detect badge-specific patterns (shield.io, badge URLs, image links in a row)
    return (
      /!\[.*\]\(.*badge.*\)/.test(line) ||
      /!\[.*\]\(.*shield\.io.*\)/.test(line) ||
      (/\[!\[.*\]\(.*\)\]\(.*\)/.test(line) &&
        (line.includes("badge") || line.includes("shield"))) ||
      /img\.shields\.io/.test(line) ||
      (line.includes("<img") &&
        (line.includes("badge") || line.includes("shield")))
    );
  }

  // First pass: Extract headers and their content
  const lines = text.split("\n");
  let inBadgeSection = false;
  let badgeSectionEndLine = 0;
  let skipToLine = -1;

  // Detect the initial badge/logo section which often appears at the start of READMEs
  for (let i = 0; i < Math.min(20, lines.length); i++) {
    if (
      (lines[i].includes('<p align="center">') ||
        lines[i].includes('align="center"') ||
        lines[i].includes('<div align="center">')) &&
      i + 5 < lines.length
    ) {
      // Check if next few lines contain images, badges, or links
      let hasImageOrBadge = false;
      for (let j = i; j < Math.min(i + 15, lines.length); j++) {
        if (
          lines[j].includes("<img") ||
          lines[j].includes("![") ||
          isBadgeLine(lines[j]) ||
          (lines[j].includes("<a href=") && lines[j].includes("</a>"))
        ) {
          hasImageOrBadge = true;
          badgeSectionEndLine = Math.max(badgeSectionEndLine, j + 1);
        }
      }

      if (hasImageOrBadge) {
        inBadgeSection = true;
      }
    }
  }

  // Process each line
  for (let i = 0; i < lines.length; i++) {
    // Skip if we're still processing a multi-line element
    if (i < skipToLine) {
      continue;
    }

    const line = lines[i];

    // Skip initial badge/logo section
    if (i <= badgeSectionEndLine && inBadgeSection) {
      continue;
    }

    // Check if this is a heading line
    const headerMatch = line.match(/^(#{1,6})\s+(.+)/);

    if (headerMatch) {
      // This is a heading - create a new section
      const level = headerMatch[1].length;
      const title = headerMatch[2].trim();

      // If we had a previous section, finalize it
      if (currentSection) {
        sections.push(currentSection);
      } else if (mainHeaderContent && !currentSection) {
        // Save content that appeared before any headers as the main description
        mainTitle = title;
        mainHeaderContent = mainHeaderContent.trim();
      }

      // Start a new section
      currentSection = {
        level,
        title,
        content: `${"#".repeat(level)} ${title}`,
        lineIndex: i,
      };
    } else if (currentSection) {
      // We're in a section, add content

      // Skip badge lines
      if (isBadgeLine(line)) {
        continue;
      }

      // Process code blocks as a unit
      if (line.trim().startsWith("```")) {
        let codeBlock = line + "\n";
        let j = i + 1;

        // Collect the entire code block
        while (j < lines.length && !lines[j].trim().startsWith("```")) {
          codeBlock += lines[j] + "\n";
          j++;
        }

        if (j < lines.length) {
          // Add closing delimiter
          codeBlock += lines[j] + "\n";
        }

        currentSection.content += "\n\n" + codeBlock;
        skipToLine = j + 1;
        continue;
      }

      // Add the line to current section with proper spacing
      if (line.trim() !== "") {
        if (
          currentSection.content ===
          `${"#".repeat(currentSection.level)} ${currentSection.title}`
        ) {
          currentSection.content += "\n\n" + line;
        } else {
          currentSection.content += "\n" + line;
        }
      } else if (
        currentSection.content !==
        `${"#".repeat(currentSection.level)} ${currentSection.title}`
      ) {
        // Add empty line if not right after the header
        currentSection.content += "\n";
      }
    } else {
      // Content before first header - collect as main description
      if (line.trim() !== "" && !isBadgeLine(line)) {
        if (mainHeaderContent) {
          mainHeaderContent += "\n" + line;
        } else {
          mainHeaderContent += line;
        }
      }
    }
  }

  // Add the last section if there is one
  if (currentSection) {
    sections.push(currentSection);
  }

  // Group sections by their hierarchy
  const chunks: string[] = [];

  // Add the main content as first chunk if it exists
  if (mainHeaderContent) {
    if (mainTitle) {
      chunks.push(`# ${mainTitle}\n\n${mainHeaderContent}`);
    } else {
      chunks.push(mainHeaderContent);
    }
  }

  // Process sections into chunks
  let currentChunk = "";
  let currentLevel = 0;
  let currentTitle = "";

  for (const section of sections) {
    // New top-level section always starts a new chunk
    if (section.level === 1 || section.level === 2) {
      if (currentChunk) {
        chunks.push(currentChunk.trim());
      }
      currentChunk = section.content;
      currentLevel = section.level;
      currentTitle = section.title;
      continue;
    }

    // If this is a subsection of the current section, add it to the current chunk
    if (section.level > currentLevel) {
      currentChunk += "\n\n" + section.content;
    } else {
      // Same level section or higher than current section (but not level 1-2)
      // Check if current chunk is getting too large
      if (currentChunk.length > 2000) {
        chunks.push(currentChunk.trim());
        currentChunk = section.content;
        currentLevel = section.level;
        currentTitle = section.title;
      } else {
        // Add to current chunk with proper separation
        currentChunk += "\n\n" + section.content;
      }
    }
  }

  // Add the final chunk
  if (currentChunk) {
    chunks.push(currentChunk.trim());
  }

  // Filter out chunks that are too small or empty
  return chunks.filter((chunk) => chunk.trim().length > 50);
}

/**
 * Process documentation text into chunks for vector storage
 * Uses specialized chunking based on content type
 * @param text - Documentation text
 * @param fileName - Optional file name to determine special chunking behavior
 * @returns Array of text chunks
 */
export function chunkDocumentation(text: string, fileName?: string): string[] {
  // First check if this is a structured document with list items (like llms.txt)
  if (fileName?.toLowerCase().includes("llms.txt")) {
    try {
      // For llms.txt files, each list item should be treated as its own chunk
      // with section header context
      const structuredChunks = chunkStructuredDocs(text);
      if (structuredChunks.length > 0) {
        return structuredChunks;
      }
    } catch (error) {
      console.warn(
        "Structured documentation chunking failed for llms.txt, trying README chunker",
      );
    }
  }

  // Then try README-specific chunking
  try {
    const readmeChunks = chunkReadme(text, fileName);
    if (readmeChunks.length > 0) {
      return readmeChunks;
    }
  } catch (error) {
    console.warn("README chunking failed, trying next chunker");
  }

  // Then try structured documentation chunking as fallback
  try {
    const structuredChunks = chunkStructuredDocs(text);
    if (structuredChunks.length > 0) {
      return structuredChunks;
    }
  } catch (error) {
    console.warn(
      "Structured documentation chunking failed, falling back to default chunker",
    );
  }

  // Fall back to the regular chunking algorithm
  return chunkText(text);
}

/**
 * Process documentation text into chunks for vector storage with improved boundaries
 * Ensures chunks respect document structure like paragraphs and headings
 * @param text - Documentation text
 * @param maxChunkSize - Maximum size of each chunk (in characters)
 * @param minChunkSize - Minimum size to consider a chunk complete (in characters)
 * @returns Array of text chunks
 */
export function chunkText(
  text: string,
  maxChunkSize: number = 1500,
  minChunkSize: number = 500,
): string[] {
  const chunks: string[] = [];

  // Split by markdown headings (## Heading)
  const headingPattern = /\n(#{1,6}\s+[^\n]+)\n/g;
  const sections = text.split(headingPattern);

  let currentChunk = "";
  let headingText = "";

  // Process each section
  for (let i = 0; i < sections.length; i++) {
    const section = sections[i];

    // Check if this is a heading
    if (i > 0 && i % 2 === 1) {
      headingText = section.trim();
      continue;
    }

    // This is content - process it with the preceding heading
    const contentWithHeading = headingText
      ? `${headingText}\n\n${section}`
      : section;

    // If content is short enough, add as single chunk
    if (contentWithHeading.length <= maxChunkSize) {
      if (contentWithHeading.trim().length > 0) {
        chunks.push(contentWithHeading.trim());
      }
      headingText = "";
      continue;
    }

    // If content is long, split by paragraphs
    const paragraphs = contentWithHeading.split(/\n\n+/);

    currentChunk = "";

    for (const paragraph of paragraphs) {
      const trimmedParagraph = paragraph.trim();

      // Skip empty paragraphs
      if (!trimmedParagraph) continue;

      // If adding this paragraph would exceed max size and we already have content
      if (
        currentChunk &&
        currentChunk.length + trimmedParagraph.length + 2 > maxChunkSize
      ) {
        // Only add the chunk if it meets minimum size
        if (currentChunk.length >= minChunkSize) {
          chunks.push(currentChunk.trim());
          currentChunk = trimmedParagraph;
        } else {
          // If current chunk is too small, continue adding content
          currentChunk += `\n\n${trimmedParagraph}`;
        }
      } else {
        // Add paragraph with double newline if not the first paragraph
        if (currentChunk) {
          currentChunk += `\n\n${trimmedParagraph}`;
        } else {
          currentChunk = trimmedParagraph;
        }
      }
    }

    // Add final chunk from section if it has content
    if (currentChunk.trim().length >= minChunkSize) {
      chunks.push(currentChunk.trim());
    }

    headingText = "";
  }

  return chunks;
}

// Define our metadata structure as a record with string keys and any values
interface VectorMetadata {
  chunk: string;
  owner: string;
  repo: string;
  chunkIndex: number;
  [key: string]: any; // Add index signature to make it compatible with Dict
}

/**
 * Store documentation content in vector store
 * Using a single index and distinguishing documents via metadata and IDs
 * @param owner - Repository owner
 * @param repo - Repository name
 * @param content - Documentation content
 * @param fileName - documentation file name
 * @returns Number of vectors stored
 */
export async function storeDocumentationVectors(
  owner: string,
  repo: string,
  content: string,
  fileName: string,
): Promise<number> {
  try {
    console.log(`Storing vectors for ${owner}/${repo}`);

    // First delete any existing vectors for this repo
    try {
      // Generate pattern matching IDs for this repo
      const prefix = `repo:${owner}:${repo}`;

      try {
        // Delete any vectors with IDs starting with our prefix
        await vector.delete(`${prefix}*`);
        console.log(`Deleted existing vectors for ${owner}/${repo}`);
      } catch (error) {
        console.log(
          `No existing vectors found for ${owner}/${repo} or error deleting`,
        );
      }
    } catch (error) {
      // Ignore errors if vectors don't exist
      console.log(`Error managing existing vectors: ${error}`);
    }

    // Use specialized documentation chunking for better results
    const chunks = chunkDocumentation(content, fileName);
    console.log(`Created ${chunks.length} chunks for ${owner}/${repo}`);

    // Generate embeddings and upsert vectors
    const vectors = [];

    for (let i = 0; i < chunks.length; i++) {
      const chunk = chunks[i];
      const embedding = await getEmbeddings(chunk);
      const id = getVectorId(owner, repo, i);

      vectors.push({
        id,
        vector: embedding,
        metadata: {
          chunk,
          owner,
          repo,
          chunkIndex: i,
        } as Dict, // Cast to Dict type to ensure compatibility
      });
    }

    // Upsert vectors one by one
    for (const vector_item of vectors) {
      await vector.upsert({
        id: vector_item.id,
        vector: vector_item.vector,
        metadata: vector_item.metadata as Dict,
      });
    }
    console.log(`Stored ${vectors.length} vectors for ${owner}/${repo}`);

    return vectors.length;
  } catch (error) {
    console.error(`Error storing vectors for ${owner}/${repo}:`, error);
    throw error;
  }
}

/**
 * Generate combined keyword&pattern score for text matching a specific query intent
 * Used in post-processing to re-rank results beyond vector similarity
 */
function calculateKeywordMatchScore(text: string, query: string): number {
  // Lower-case for case-insensitive matching
  const lowerText = text.toLowerCase();
  const lowerQuery = query.toLowerCase();

  // Detect query intent
  const isInstallationQuery =
    /\bhow\b.*\binstall\b|\bsetup\b|\binstallation\b/i.test(lowerQuery);
  const isUsageQuery = /\bhow\b.*\buse\b|\busage\b|\bexample\b/i.test(
    lowerQuery,
  );
  const isErrorQuery = /\berror\b|\bissue\b|\bproblem\b|\bfail\b/i.test(
    lowerQuery,
  );

  let score = 0;

  // Penalize license sections, which are rarely relevant
  if (
    /^#+\s+license\b/im.test(text) ||
    text.toLowerCase().includes("mit license")
  ) {
    score -= 0.3;
  }

  // Penalize badge sections which are usually not informative for queries
  if (
    /\]\(https?:\/\/[^)]*badge[^)]*\)/i.test(text) &&
    text.split("\n").length < 8
  ) {
    score -= 0.2;
  }

  // Boost sections that likely contain actual information
  if (
    /^#+\s+(what is|getting started|introduction|usage|examples|installation)/im.test(
      text,
    )
  ) {
    score += 0.3;
  }

  // Extract terms from query (removing stop words)
  const queryTerms = lowerQuery
    .split(/\W+/)
    .filter((term) => term.length > 2 && !commonWords.has(term));

  // Count term occurrences in text
  for (const term of queryTerms) {
    // Use regex to find whole word matches
    const regex = new RegExp(`\\b${term}\\b`, "gi");
    const matches = lowerText.match(regex) || [];

    // Add score based on frequency
    score += matches.length * 0.05;
  }

  // Boost for heading matches (much higher boost than before)
  const headings = text.match(/#{1,6}\s+([^\n]+)/g) || [];
  for (const heading of headings) {
    const lowerHeading = heading.toLowerCase();
    for (const term of queryTerms) {
      if (lowerHeading.includes(term)) {
        score += 0.25; // Higher boost for term in heading
      }
    }
  }

  // Check for query term proximity (terms appearing close together)
  if (queryTerms.length > 1) {
    // Find all occurrences of first query term
    for (let i = 0; i < lowerText.length; i++) {
      const termIndex = lowerText.indexOf(queryTerms[0], i);
      if (termIndex === -1) break;

      // Look for other query terms within 50 chars
      const proximityWindow = lowerText.substring(termIndex, termIndex + 100);
      let proximityMatches = 0;

      for (let j = 1; j < queryTerms.length; j++) {
        if (proximityWindow.includes(queryTerms[j])) {
          proximityMatches++;
        }
      }

      // Add score based on proximity matches
      score += (proximityMatches / (queryTerms.length - 1)) * 0.15;

      // Move past this occurrence
      i = termIndex;
    }
  }

  return score;
}

/**
 * Search for relevant documentation
 * With improved post-processing for better relevance ranking
 * @param owner - Repository owner
 * @param repo - Repository name
 * @param query - Search query
 * @param limit - Maximum number of results to return
 * @returns Array of relevant document chunks with scores
 */
export async function searchDocumentation(
  owner: string,
  repo: string,
  query: string,
  limit: number = 5,
): Promise<Array<{ chunk: string; score: number }>> {
  try {
    const queryEmbedding = await getEmbeddings(query);

    // Query vectors without using filter prefix
    const results = await vector.query({
      vector: queryEmbedding,
      topK: limit, // Query more results than needed
      filter: `owner = "${owner}" AND repo = "${repo}"`,
      includeMetadata: true,
    });

    console.log(
      `Found ${Array.isArray(results) ? results.length : 0} results for ${owner}/${repo}`,
    );

    if (!results || !Array.isArray(results)) {
      console.warn(`No results found for ${owner}/${repo}`);
      return [];
    }

    // Filter results by owner and repo manually
    const filteredResults = results.filter((result) => {
      const metadata = result.metadata as Dict;
      return metadata?.owner === owner && metadata?.repo === repo;
    });

    console.log(
      `Found ${filteredResults.length} matching results for ${owner}/${repo} after filtering`,
    );

    // Enhanced ranking: combine vector similarity with keyword matching
    const enhancedResults = filteredResults.map((result) => {
      const metadata = result.metadata as Dict;
      const chunk = metadata?.chunk || "";

      // Calculate keyword match score
      const keywordScore = calculateKeywordMatchScore(chunk, query);

      // Combine scores (vector similarity + keyword matching)
      // Normalize vector similarity from [-1,1] to [0,1] range
      const normalizedVectorScore = (result.score + 1) / 2;

      // Combined score gives weight to both vector similarity and keyword matches
      const combinedScore = normalizedVectorScore * 0.6 + keywordScore * 0.4;

      return {
        chunk,
        vectorScore: result.score,
        keywordScore,
        combinedScore,
      };
    });

    // Sort by combined score
    enhancedResults.sort((a, b) => b.combinedScore - a.combinedScore);

    // Return with the combined score for better differentiation
    return enhancedResults.slice(0, limit).map((result) => ({
      chunk: result.chunk,
      score: result.combinedScore,
    }));
  } catch (error) {
    console.error(`Error searching documentation for ${owner}/${repo}:`, error);
    return [];
  }
}

/**
 * Specialized chunker for documentation that maintains document structure
 * Each chunk contains one documentation entry along with its section context
 * @param text - Documentation text in markdown format
 * @returns Array of text chunks with preserved structure
 */
export function chunkStructuredDocs(text: string): string[] {
  // Check if this is a special llms.txt file that needs list-item level chunking
  //   const isLlmsFile = fileName?.toLowerCase().includes('llms.txt');

  // Quick check to see if this looks like structured documentation
  // Check for both link patterns: [title](url) and nested list items with links
  //   const hasLinkPatterns = /\[.+?\]\(.+?\)/.test(text);
  //   const hasListItems = /^[-*]\s+/.test(text);

  // For llms.txt files, we want to process them even if they don't have link patterns
  // as long as they have list items or link patterns
  //   if (!isLlmsFile && !hasLinkPatterns) {
  //     return chunkText(text);
  //   }

  // For non-llms files that don't have link patterns or list items, use regular chunking
  //   if (!isLlmsFile && !hasLinkPatterns && !hasListItems) {
  //     return chunkText(text);
  //   }

  const chunks: string[] = [];
  const lines = text.split("\n");

  // Step 1: Extract all headers and build a header hierarchy
  interface HeaderInfo {
    level: number;
    title: string;
    lineIndex: number;
  }

  const headers: HeaderInfo[] = [];

  lines.forEach((line, index) => {
    const headerMatch = line.match(/^(#{1,6})\s+(.*)/);
    if (headerMatch) {
      headers.push({
        level: headerMatch[1].length,
        title: headerMatch[2].trim(),
        lineIndex: index,
      });
    }
  });

  // If there's at least one header, create a chunk with the document title and description
  if (headers.length > 0) {
    const mainHeader = headers[0];
    let mainDescription = "";

    // Collect the main description until we hit another header or a blank line followed by a list item
    for (let i = mainHeader.lineIndex + 1; i < lines.length; i++) {
      const line = lines[i].trim();

      // Stop if we hit another header
      if (line.match(/^#{1,6}\s+/)) break;

      // Stop if we hit a blank line followed by a list item
      if (
        line === "" &&
        i + 1 < lines.length &&
        (lines[i + 1].trim().startsWith("- ") ||
          lines[i + 1].trim().startsWith("* "))
      )
        break;

      if (line !== "") {
        mainDescription += mainDescription ? "\n" + line : line;
      }
    }

    // Create a chunk with main title and description
    if (mainDescription) {
      chunks.push(`# ${mainHeader.title}\n\n${mainDescription}`);
    }
  }

  // Find the current section header for context
  const getCurrentHeader = (lineIndex: number): string => {
    let headerContext = "";
    let currentHeaderLevel = Number.MAX_SAFE_INTEGER;

    for (const header of headers) {
      if (header.lineIndex < lineIndex && header.level <= currentHeaderLevel) {
        headerContext = `${"#".repeat(header.level)} ${header.title}`;
        currentHeaderLevel = header.level;

        // If it's the main h1 header, we don't need to go further
        // This ensures we get the nearest section header, not the document title
        if (
          header.level === 1 &&
          headers.some((h) => h.level === 2 && h.lineIndex < lineIndex)
        ) {
          continue;
        }

        // We found a direct section header (h2 or h3)
        if (header.level === 2 || header.level === 3) {
          break;
        }
      }
    }

    return headerContext;
  };

  // Step 2: Process content based on document type
  // For llms.txt files, we need to handle both bullet point lists and non-bullet point format

  // First, try to find non-bullet point entries like:
  // [Title](URL): Description
  let i = 0;
  while (i < lines.length) {
    const line = lines[i].trim();

    // Check for section headers
    const headerMatch = line.match(/^#{1,6}\s+/);
    if (headerMatch) {
      // Skip headers for now - we'll handle them separately
      i++;
      continue;
    }

    // Match link pattern at the start of a line with a description
    // Matches [Title](URL): Description pattern
    const linkDescMatch = line.match(/^\[([^\]]+)\]\(([^)]+)\)(\s*:\s*.*)?/);
    if (linkDescMatch) {
      // Found a link with description pattern
      let entryContent = line;
      let j = i + 1;

      // Look for continuation of this entry
      while (j < lines.length) {
        const nextLine = lines[j].trim();

        // Stop if we hit a header, a new link pattern, or a list item
        if (
          nextLine.match(/^#{1,6}\s+/) ||
          nextLine.match(/^\[([^\]]+)\]\(([^)]+)\)/) ||
          nextLine.startsWith("- ") ||
          nextLine.startsWith("* ")
        ) {
          break;
        }

        // Add non-empty lines to the entry
        if (nextLine !== "") {
          entryContent += "\n" + nextLine;
          j++;
        } else {
          // Empty line
          j++;

          // Check if the next line starts a new entry
          if (j < lines.length) {
            const lineAfterBlank = lines[j].trim();
            if (
              lineAfterBlank.match(/^#{1,6}\s+/) ||
              lineAfterBlank.match(/^\[([^\]]+)\]\(([^)]+)\)/) ||
              lineAfterBlank.startsWith("- ") ||
              lineAfterBlank.startsWith("* ")
            ) {
              break;
            }
          }
        }
      }

      // Get the current header context
      const headerContext = getCurrentHeader(i);

      // Create a chunk with header context + entry
      if (headerContext) {
        chunks.push(`${headerContext}\n\n${entryContent}`);
      } else {
        chunks.push(entryContent);
      }

      i = j;
      continue;
    }

    // Look for list items (bullet points)
    if (line.startsWith("- ") || line.startsWith("* ")) {
      // Process list items as individual chunks

      // Start with the current line as the item content
      let itemContent = line;
      let j = i + 1;

      // Look for continuation of the description on subsequent lines
      while (j < lines.length) {
        const nextLine = lines[j].trim();

        // Stop if we hit another list item or header
        if (
          nextLine.startsWith("- ") ||
          nextLine.startsWith("* ") ||
          nextLine.match(/^#{1,6}\s+/) ||
          nextLine.match(/^\[([^\]]+)\]\(([^)]+)\)/)
        ) {
          break;
        }

        // Add non-empty lines to description
        if (nextLine !== "") {
          itemContent += "\n" + nextLine;
          j++;
        } else {
          // Skip empty line
          j++;

          // But check if next line is a new item or different content
          if (j < lines.length) {
            const lineAfterBlank = lines[j].trim();
            if (
              lineAfterBlank.startsWith("- ") ||
              lineAfterBlank.startsWith("* ") ||
              lineAfterBlank.match(/^#{1,6}\s+/) ||
              lineAfterBlank.match(/^\[([^\]]+)\]\(([^)]+)\)/)
            ) {
              break;
            }
          }
        }
      }

      // Get header context for this item
      const headerContext = getCurrentHeader(i);

      // Create a separate chunk for this list item with its section context
      if (headerContext) {
        chunks.push(`${headerContext}\n\n${itemContent}`);
      } else {
        chunks.push(itemContent);
      }

      i = j;
      continue;
    }

    // Regular content - move to next line
    i++;
  }

  // Filter out duplicate chunks and very short chunks
  const uniqueChunks = Array.from(new Set(chunks))
    .filter((chunk) => chunk.length > 10)
    .map((chunk) => chunk.trim());

  // If we didn't find any chunks with our approach, fall back to standard chunking
  if (uniqueChunks.length === 0) {
    return chunkText(text);
  }

  return uniqueChunks;
}
