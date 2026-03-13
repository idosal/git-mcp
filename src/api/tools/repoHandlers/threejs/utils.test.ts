import { describe, it, expect, vi } from "vitest";
import { getReferenceDocsContent } from "./utils.js";

const THREEJS_DOCS_REF_URL = "https://threejs.org/docs/list.json";
const THREEJS_MANUAL_REF_URL = "https://threejs.org/manual/list.json";

vi.mock("../../../utils/cache.js", () => ({
  fetchUrlContent: vi.fn(
    async ({
      url,
      format,
    }: {
      url: string;
      format: "json" | "text";
    }): Promise<Record<string, unknown> | string | null> => {
      if (format === "json") {
        if (url === THREEJS_DOCS_REF_URL) {
          return {
            en: {
              api: {
                audio: { AudioContext: "api/en/audio/AudioContext" },
                constants: {
                  "api/en/constants/BufferAttributeUsage":
                    "api/en/constants/BufferAttributeUsage",
                },
              },
            },
          };
        }
        if (url === THREEJS_MANUAL_REF_URL) {
          return {
            en: {
              section: {
                "Debugging JavaScript": "en/Debugging-JavaScript",
                "en/tips#preservedrawingbuffer":
                  "en/tips#preservedrawingbuffer",
              },
            },
          };
        }
      }
      if (format === "text" && url.includes("threejs.org")) {
        return "<h1>Documentation</h1><p>Content for the requested page.</p>";
      }
      return null;
    },
  ),
}));

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
