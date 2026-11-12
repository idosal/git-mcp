/**
 * Helpers for reading a repository's GitHub wiki.
 *
 * GitHub wikis are separate git repositories. Their raw Markdown is served from
 * https://raw.githubusercontent.com/wiki/{owner}/{repo}/{Page-Name}.md and the
 * list of pages is rendered at https://github.com/{owner}/{repo}/wiki/_pages.
 */

export const WIKI_HOME_PAGE = "Home";

export function getWikiBaseUrl(owner: string, repo: string): string {
  return `https://github.com/${owner}/${repo}/wiki`;
}

export function getWikiPagesListUrl(owner: string, repo: string): string {
  return `${getWikiBaseUrl(owner, repo)}/_pages`;
}

export function getWikiPageUrl(
  owner: string,
  repo: string,
  slug: string,
): string {
  return `${getWikiBaseUrl(owner, repo)}/${encodeURIComponent(slug)}`;
}

export function getWikiRawPageUrl(
  owner: string,
  repo: string,
  slug: string,
): string {
  return `https://raw.githubusercontent.com/wiki/${owner}/${repo}/${encodeURIComponent(slug)}.md`;
}

function safeDecodeURIComponent(value: string): string {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}

/**
 * Convert a user-provided page reference into a wiki page slug.
 *
 * Accepts a page title ("Getting Started"), a slug ("Getting-Started"),
 * a file name ("Getting-Started.md") or a full wiki URL
 * ("https://github.com/owner/repo/wiki/Getting-Started").
 * Returns an empty string when no specific page was requested.
 */
export function normalizeWikiPageName(page: string | null | undefined): string {
  if (!page) {
    return "";
  }

  let value = page.trim();

  // Strip everything up to and including "/wiki/" for full wiki URLs
  const wikiUrlMatch = value.match(/\/wiki(?:\/([^?#]*))?(?:[?#].*)?$/i);
  if (/^https?:\/\//i.test(value) && wikiUrlMatch) {
    value = wikiUrlMatch[1] ?? "";
  }

  value = safeDecodeURIComponent(value)
    .replace(/\.md$/i, "")
    .replace(/^\/+|\/+$/g, "")
    .trim()
    .replace(/\s+/g, "-");

  return value;
}

/**
 * Convert a wiki slug into a human readable title ("Getting-Started" -> "Getting Started").
 */
export function wikiSlugToTitle(slug: string): string {
  return slug.replace(/-/g, " ");
}

function decodeHtmlEntities(value: string): string {
  return value
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">");
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/**
 * Extract the wiki page slugs from the HTML of the `/wiki/_pages` page.
 * GitHub-internal pages such as `_new` or `_history` are ignored. The Home
 * page is linked as a bare `/wiki` (which also appears in the repository
 * navigation), so it is not included here; callers add it once they know it exists.
 */
export function parseWikiPageList(
  html: string,
  owner: string,
  repo: string,
): string[] {
  const linkPattern = new RegExp(
    `href="/${escapeRegExp(owner)}/${escapeRegExp(repo)}/wiki(?:/([^"#?]*))?"`,
    "gi",
  );

  const pages = new Set<string>();
  for (const match of html.matchAll(linkPattern)) {
    const slug = safeDecodeURIComponent(decodeHtmlEntities(match[1] ?? ""));
    if (
      !slug ||
      slug === WIKI_HOME_PAGE ||
      slug.startsWith("_") ||
      slug.includes("/")
    ) {
      continue;
    }
    pages.add(slug);
  }

  return [...pages].sort((a, b) =>
    a.localeCompare(b, "en", { sensitivity: "base" }),
  );
}

/**
 * Format the list of wiki pages as a Markdown list.
 */
export function formatWikiPageList(pages: string[]): string {
  return pages
    .map((slug) => `- ${wikiSlugToTitle(slug)} (page: \`${slug}\`)`)
    .join("\n");
}
