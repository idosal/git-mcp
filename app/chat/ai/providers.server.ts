import { createOpenAI } from "@ai-sdk/openai";
import { createGroq } from "@ai-sdk/groq";
import { createAnthropic } from "@ai-sdk/anthropic";
import { createXai } from "@ai-sdk/xai";

import {
  customProvider,
  wrapLanguageModel,
  extractReasoningMiddleware,
  type LanguageModel,
} from "ai";
import type { modelID, StorageKey } from "./providers.shared";

const middleware = extractReasoningMiddleware({
  tagName: "think",
});

export const getModel = (
  env: CloudflareEnvironment,
  apiKeys: Partial<Record<StorageKey, string>>,
) => {
  // Helper to get API keys from environment variables first, then localStorage
  const getApiKey = (key: StorageKey): string | undefined => {
    // Check for environment variables first
    if (env[key]) {
      return env[key] || undefined;
    }

    // Check for API keys in localStorage
    if (apiKeys[key]) {
      return apiKeys[key] || undefined;
    }

    return undefined;
  };

  // Create provider instances with API keys from env/user/localStorage
  const openaiClient = createOpenAI({
    apiKey: getApiKey("OPENAI_API_KEY"),
  });

  const anthropicClient = createAnthropic({
    apiKey: getApiKey("ANTHROPIC_API_KEY"),
  });

  const groqClient = createGroq({
    apiKey: getApiKey("GROQ_API_KEY"),
  });

  const xaiClient = createXai({
    apiKey: getApiKey("XAI_API_KEY"),
  });

  const languageModels: Record<modelID, LanguageModel> = {
    "gpt-4.1-mini": openaiClient("gpt-4.1-mini"),
    "claude-3-7-sonnet": anthropicClient("claude-3-7-sonnet-20250219"),
    "qwen-qwq": wrapLanguageModel({
      model: groqClient("qwen-qwq-32b"),
      middleware,
    }),
    "grok-3-mini": xaiClient("grok-3-mini-latest"),
  };

  const model = customProvider({
    languageModels,
  });

  return model;
};
