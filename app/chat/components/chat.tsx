"use client";

import {
  defaultModel,
  type modelID,
  type CustomModelConfig,
} from "~/chat/ai/providers.shared";
import { useChat } from "@ai-sdk/react";
import { Textarea } from "./textarea";
import { ProjectOverview } from "./project-overview";
import { Messages } from "./messages";
import { toast } from "sonner";
import { useLocalStorage } from "~/chat/lib/hooks/use-local-storage";
import { useMCP } from "~/chat/lib/context/mcp-context";
import { useCallback, useState, useEffect } from "react";
import { useApiKeys } from "./api-keys-provider";
import { STORAGE_KEYS } from "~/chat/lib/constants";

const CHAT_API_URL = "https://chat-api-worker.idosalomon.workers.dev/api/chat";

export default function Chat() {
  const [selectedModel, setSelectedModel] = useLocalStorage<modelID | string>(
    "selectedModel",
    defaultModel,
  );

  const { apiKeys } = useApiKeys();

  // Load custom models from localStorage
  const [customModels, setCustomModels] = useState<CustomModelConfig[]>([]);

  useEffect(() => {
    const loadCustomModels = () => {
      try {
        const stored = localStorage.getItem(STORAGE_KEYS.CUSTOM_MODELS);
        setCustomModels(stored ? JSON.parse(stored) : []);
      } catch (error) {
        console.error("Error loading custom models:", error);
        setCustomModels([]);
      }
    };

    loadCustomModels();

    // Listen for storage events (from other tabs) and custom events (same tab)
    const handleStorageChange = () => {
      loadCustomModels();
    };

    window.addEventListener("storage", handleStorageChange);
    window.addEventListener("customModelsChanged", handleStorageChange);
    return () => {
      window.removeEventListener("storage", handleStorageChange);
      window.removeEventListener("customModelsChanged", handleStorageChange);
    };
  }, []);

  // Get MCP server data from context
  const { mcpServersForApi } = useMCP();

  const { messages, input, handleInputChange, handleSubmit, status, stop } =
    useChat({
      api: CHAT_API_URL,
      maxSteps: 20,
      body: {
        selectedModel,
        mcpServers: mcpServersForApi,
        apiKeys,
        customModels,
      },
      experimental_throttle: 500,
      onError: (error) => {
        toast.error(
          error.message.length > 0
            ? error.message
            : "An error occurred, please try again later.",
          { position: "top-center", richColors: true },
        );
      },
    });

  // Custom submit handler
  const handleFormSubmit = useCallback(
    (e: React.FormEvent<HTMLFormElement>) => {
      e.preventDefault();
      handleSubmit(e);
    },
    [input, handleSubmit],
  );

  const isLoading = status === "streaming" || status === "submitted";

  return (
    <div className="h-dvh flex flex-col justify-center w-full max-w-3xl mx-auto px-4 sm:px-6 md:py-4">
      {messages.length === 0 ? (
        <div className="max-w-xl mx-auto w-full">
          <ProjectOverview />
          <form onSubmit={handleFormSubmit} className="mt-4 w-full mx-auto">
            <Textarea
              selectedModel={selectedModel}
              setSelectedModel={setSelectedModel}
              handleInputChange={handleInputChange}
              input={input}
              isLoading={isLoading}
              status={status}
              stop={stop}
            />
          </form>
        </div>
      ) : (
        <>
          <div className="flex-1 overflow-y-auto min-h-0 pb-2">
            <Messages
              messages={messages}
              isLoading={isLoading}
              status={status}
            />
          </div>
          <form
            onSubmit={handleFormSubmit}
            className="mt-2 w-full mx-auto mb-4 sm:mb-auto"
          >
            <Textarea
              selectedModel={selectedModel}
              setSelectedModel={setSelectedModel}
              handleInputChange={handleInputChange}
              input={input}
              isLoading={isLoading}
              status={status}
              stop={stop}
            />
          </form>
        </>
      )}
    </div>
  );
}
