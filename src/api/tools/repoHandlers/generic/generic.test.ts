import { describe, it, expect, beforeAll } from "vitest";
import { MockMcp } from "../test/utils";
import * as toolsModule from "../../index";

// @ts-ignore
const mockEnv: Env = {};

describe("Generic Repo Handler", () => {
  let mockMcp: MockMcp;

  beforeAll(() => {
    mockMcp = new MockMcp();
    toolsModule
      .getMcpTools(mockEnv, "docs.gitmcp.io", "https://docs.gitmcp.io", {
        waitUntil: () => Promise.resolve(),
      })
      .forEach((tool) => {
        mockMcp.tool(tool.name, tool.description, tool.paramsSchema, tool.cb);
      });
  });

  it("should return library correctly ElevenLabs", async () => {
    const library = "ElevenLabs";
    const owner = "elevenlabs";
    const repo = "elevenlabs-docs";

    const tool = mockMcp.getTool("match_common_libs_owner_repo_mapping");
    const result = await tool.cb({ library });
    expect(result).toEqual({
      content: [
        {
          type: "text",
          text: JSON.stringify({
            library,
            owner,
            repo,
          }),
        },
      ],
    });
  });

  it("should return library correctly for unknown library", async () => {
    const library = "UnknownLibrary";

    const tool = mockMcp.getTool("match_common_libs_owner_repo_mapping");
    const result = await tool.cb({ library });
    expect(result).toEqual({
      content: [
        {
          type: "text",
          text: `No owner/repo found for ${library}`,
        },
      ],
    });
  });
});
