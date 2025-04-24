export interface ModelInfo {
  provider: string;
  name: string;
  description: string;
  apiVersion: string;
  capabilities: string[];
}

export type StorageKey =
  | "OPENAI_API_KEY"
  | "ANTHROPIC_API_KEY"
  | "GROQ_API_KEY"
  | "XAI_API_KEY";

export type modelID =
  | "gpt-4.1-mini"
  | "claude-3-7-sonnet"
  | "qwen-qwq"
  | "grok-3-mini";

export const modelDetails: Record<modelID, ModelInfo> = {
  "gpt-4.1-mini": {
    provider: "OpenAI",
    name: "GPT-4.1 Mini",
    description:
      "Compact version of OpenAI's GPT-4.1 with good balance of capabilities, including vision.",
    apiVersion: "gpt-4.1-mini",
    capabilities: ["Balance", "Creative", "Vision"],
  },
  "claude-3-7-sonnet": {
    provider: "Anthropic",
    name: "Claude 3.7 Sonnet",
    description:
      "Latest version of Anthropic's Claude 3.7 Sonnet with strong reasoning and coding capabilities.",
    apiVersion: "claude-3-7-sonnet-20250219",
    capabilities: ["Reasoning", "Efficient", "Agentic"],
  },
  "qwen-qwq": {
    provider: "Groq",
    name: "Qwen QWQ",
    description:
      "Latest version of Alibaba's Qwen QWQ with strong reasoning and coding capabilities.",
    apiVersion: "qwen-qwq",
    capabilities: ["Reasoning", "Efficient", "Agentic"],
  },
  "grok-3-mini": {
    provider: "XAI",
    name: "Grok 3 Mini",
    description:
      "Latest version of XAI's Grok 3 Mini with strong reasoning and coding capabilities.",
    apiVersion: "grok-3-mini-latest",
    capabilities: ["Reasoning", "Efficient", "Agentic"],
  },
};

export const MODELS = Object.keys(modelDetails);

export const defaultModel: modelID = "qwen-qwq";
