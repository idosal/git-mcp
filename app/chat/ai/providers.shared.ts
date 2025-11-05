export interface ModelInfo {
  provider: string;
  name: string;
  description: string;
  apiVersion: string;
  capabilities: string[];
}

export interface CustomModelConfig {
  id: string; // unique identifier
  label: string; // custom display name
  baseURL: string; // API base URL
  apiKey: string; // API key for this model
  modelName: string; // the actual model name to use in API calls
  provider?: string; // optional provider name for display
  description?: string; // optional description
  capabilities?: string[]; // optional capabilities
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

// Helper functions for custom models
export function getCustomModels(): CustomModelConfig[] {
  if (typeof window === "undefined") return [];
  try {
    const stored = localStorage.getItem("custom-models");
    return stored ? JSON.parse(stored) : [];
  } catch {
    return [];
  }
}

export function getAllModels(): { id: string; info: ModelInfo }[] {
  const builtInModels = MODELS.map((id) => ({
    id,
    info: modelDetails[id as modelID],
  }));

  const customModels = getCustomModels().map((config) => ({
    id: config.id,
    info: {
      provider: config.provider || "Custom",
      name: config.label,
      description: config.description || `Custom model: ${config.modelName}`,
      apiVersion: config.modelName,
      capabilities: config.capabilities || ["Custom"],
    },
  }));

  return [...builtInModels, ...customModels];
}
