import { describe, it, expect } from "vitest";
import {
  formatWikiPageList,
  getWikiPageUrl,
  getWikiPagesListUrl,
  getWikiRawPageUrl,
  normalizeWikiPageName,
  parseWikiPageList,
  wikiSlugToTitle,
} from "./wiki";

describe("wiki URLs", () => {
  it("builds the wiki page, page list and raw Markdown URLs", () => {
    expect(getWikiPagesListUrl("myorg", "myrepo")).toBe(
      "https://github.com/myorg/myrepo/wiki/_pages",
    );
    expect(getWikiPageUrl("myorg", "myrepo", "Getting-Started")).toBe(
      "https://github.com/myorg/myrepo/wiki/Getting-Started",
    );
    expect(getWikiRawPageUrl("myorg", "myrepo", "Getting-Started")).toBe(
      "https://raw.githubusercontent.com/wiki/myorg/myrepo/Getting-Started.md",
    );
  });

  it("encodes special characters in page names", () => {
    expect(getWikiRawPageUrl("myorg", "myrepo", "[DEV]-Build?")).toBe(
      "https://raw.githubusercontent.com/wiki/myorg/myrepo/%5BDEV%5D-Build%3F.md",
    );
  });
});

describe("normalizeWikiPageName", () => {
  it("returns an empty string when no page is given", () => {
    expect(normalizeWikiPageName(undefined)).toBe("");
    expect(normalizeWikiPageName(null)).toBe("");
    expect(normalizeWikiPageName("   ")).toBe("");
  });

  it("converts page titles to slugs", () => {
    expect(normalizeWikiPageName("Getting Started")).toBe("Getting-Started");
    expect(normalizeWikiPageName("  Build   and Test ")).toBe("Build-and-Test");
  });

  it("keeps slugs and strips the Markdown extension", () => {
    expect(normalizeWikiPageName("Getting-Started")).toBe("Getting-Started");
    expect(normalizeWikiPageName("Getting-Started.md")).toBe("Getting-Started");
  });

  it("extracts the page from full wiki URLs", () => {
    expect(
      normalizeWikiPageName(
        "https://github.com/myorg/myrepo/wiki/Getting-Started#install",
      ),
    ).toBe("Getting-Started");
    expect(
      normalizeWikiPageName(
        "https://github.com/myorg/myrepo/wiki/%5BDEV%5D-Build",
      ),
    ).toBe("[DEV]-Build");
    expect(normalizeWikiPageName("https://github.com/myorg/myrepo/wiki")).toBe(
      "",
    );
  });

  it("does not throw on malformed percent-encoding", () => {
    expect(normalizeWikiPageName("100%-Coverage")).toBe("100%-Coverage");
  });
});

describe("wikiSlugToTitle", () => {
  it("replaces dashes with spaces", () => {
    expect(wikiSlugToTitle("Getting-Started")).toBe("Getting Started");
  });
});

describe("parseWikiPageList", () => {
  const html = `
    <a href="/myorg/myrepo">myrepo</a>
    <a href="/myorg/myrepo/wiki">Wiki</a>
    <a href="/myorg/myrepo/wiki/_new">New page</a>
    <a href="/myorg/myrepo/wiki/_history">History</a>
    <a href="/myorg/myrepo/wiki/Home">Home</a>
    <a href="/myorg/myrepo/wiki/installation">installation</a>
    <a href="/myorg/myrepo/wiki/Getting-Started">Getting Started</a>
    <a href="/myorg/myrepo/wiki/Getting-Started#usage">Usage</a>
    <a href="/myorg/myrepo/wiki/%5BDEV%5D-Build">[DEV] Build</a>
    <a href="/myorg/myrepo/wiki/Q&amp;A">Q&amp;A</a>
    <a href="/otherorg/otherrepo/wiki/Elsewhere">Elsewhere</a>
  `;

  it("extracts unique, sorted page slugs and skips GitHub-internal pages", () => {
    expect(parseWikiPageList(html, "myorg", "myrepo")).toEqual([
      "[DEV]-Build",
      "Getting-Started",
      "installation",
      "Q&A",
    ]);
  });

  it("matches the repository case-insensitively", () => {
    expect(parseWikiPageList(html, "MyOrg", "MyRepo")).toContain(
      "Getting-Started",
    );
  });

  it("returns no pages when the HTML has no wiki links", () => {
    expect(
      parseWikiPageList('<a href="/myorg/myrepo">x</a>', "myorg", "myrepo"),
    ).toEqual([]);
  });
});

describe("formatWikiPageList", () => {
  it("formats pages as a Markdown list", () => {
    expect(formatWikiPageList(["Home", "Getting-Started"])).toBe(
      "- Home (page: `Home`)\n- Getting Started (page: `Getting-Started`)",
    );
  });
});
