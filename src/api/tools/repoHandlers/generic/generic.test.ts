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
    const libraryTitle = "ElevenLabs";
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
            libraryTitle,
            owner,
            repo,
          }),
        },
      ],
    });
  });

  it("should return library correctly react-router", async () => {
    const library = "react-router";
    const libraryTitle = "React Router";
    const owner = "remix-run";
    const repo = "react-router";

    const tool = mockMcp.getTool("match_common_libs_owner_repo_mapping");
    const result = await tool.cb({ library });
    expect(result).toEqual({
      content: [
        {
          type: "text",
          text: JSON.stringify({
            library,
            libraryTitle,
            owner,
            repo,
          }),
        },
      ],
    });
  });

  it("should return library correctly Next-Auth", async () => {
    const library = "Next-Auth";
    const libraryTitle = "NextAuth.js";
    const owner = "nextauthjs";
    const repo = "next-auth";

    const tool = mockMcp.getTool("match_common_libs_owner_repo_mapping");
    const result = await tool.cb({ library });
    expect(result).toEqual({
      content: [
        {
          type: "text",
          text: JSON.stringify({
            library,
            libraryTitle,
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
