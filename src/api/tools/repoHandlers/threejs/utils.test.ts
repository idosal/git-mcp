import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  getReferenceDocsListAsMarkdown,
  getReferenceDocsContent,
  fetchThreeJsUrlsAsMarkdown,
} from "./utils.js";

describe("Threejs Utils", () => {
  it("should get the reference docs list as markdown", async () => {
    const result = await getReferenceDocsContent({
      // @ts-ignore
      env: {},
      documents: [
        { documentName: "AudioContext" },
        { documentName: "api/en/constants/BufferAttributeUsage" },
        { documentName: "Debugging JavaScript" },
        { documentName: "en/tips#preservedrawingbuffer" },
      ],
    });
    expect(result.content[0].text).toMatchSnapshot();
  });
});
