import { useState, useCallback } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "~/chat/components/ui/dialog";
import { Button } from "~/chat/components/ui/button";
import { Input } from "~/chat/components/ui/input";
import { Label } from "~/chat/components/ui/label";
import { toast } from "sonner";
import { STORAGE_KEYS } from "~/chat/lib/constants";
import type { StorageKey } from "../ai/providers.shared";
import { useApiKeys } from "./api-keys-provider";

// API key configuration
export interface ApiKeyConfig {
  name: string;
  key: string;
  storageKey: StorageKey;
  label: string;
  placeholder: string;
}

// Available API keys configuration
export const API_KEYS_CONFIG: readonly ApiKeyConfig[] = [
  {
    name: "OpenAI",
    key: "openai",
    storageKey: "OPENAI_API_KEY",
    label: "OpenAI API Key",
    placeholder: "sk-...",
  },
  {
    name: "Anthropic",
    key: "anthropic",
    storageKey: "ANTHROPIC_API_KEY",
    label: "Anthropic API Key",
    placeholder: "sk-ant-...",
  },
  {
    name: "Groq",
    key: "groq",
    storageKey: "GROQ_API_KEY",
    label: "Groq API Key",
    placeholder: "gsk_...",
  },
  {
    name: "XAI",
    key: "xai",
    storageKey: "XAI_API_KEY",
    label: "XAI API Key",
    placeholder: "xai-...",
  },
] as const;

interface ApiKeyManagerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function ApiKeyManager({ open, onOpenChange }: ApiKeyManagerProps) {
  // State to store API keys
  const { apiKeys, setApiKeys } = useApiKeys();
  const [localApiKeys, setLocalApiKeys] =
    useState<Partial<Record<StorageKey, string>>>(apiKeys);

  // Update API key in state
  const handleApiKeyChange = useCallback(
    (storageKey: StorageKey, value: string) => {
      setLocalApiKeys((prev) => ({
        ...prev,
        [storageKey]: value,
      }));
    },
    [],
  );

  // Save API keys to localStorage
  const handleSaveApiKeys = useCallback(() => {
    try {
      setApiKeys(localApiKeys);
      localStorage.setItem(STORAGE_KEYS.API_KEYS, JSON.stringify(localApiKeys));

      toast.success("API keys saved successfully");
      onOpenChange(false);
    } catch (error) {
      console.error("Error saving API keys:", error);
      toast.error("Failed to save API keys");
    }
  }, [localApiKeys, setApiKeys, onOpenChange]);

  // Clear all API keys
  const handleClearApiKeys = useCallback(() => {
    try {
      setLocalApiKeys({});
      setApiKeys({});
      toast.success("All API keys cleared");
    } catch (error) {
      console.error("Error clearing API keys:", error);
      toast.error("Failed to clear API keys");
    }
  }, [setApiKeys, localApiKeys]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>API Key Settings</DialogTitle>
          <DialogDescription>
            Enter your own API keys for different AI providers. Keys are stored
            securely in your browser&apos;s local storage.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4 py-4">
          {API_KEYS_CONFIG.map((config) => (
            <div key={config.storageKey} className="grid gap-2">
              <Label htmlFor={config.storageKey}>{config.label}</Label>
              <Input
                id={config.storageKey}
                type="password"
                value={localApiKeys[config.storageKey] || ""}
                onChange={(e) =>
                  handleApiKeyChange(config.storageKey, e.target.value)
                }
                placeholder={config.placeholder}
              />
            </div>
          ))}
        </div>

        <DialogFooter className="flex justify-between sm:justify-between">
          <Button variant="destructive" onClick={handleClearApiKeys}>
            Clear All Keys
          </Button>
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button onClick={handleSaveApiKeys}>Save Keys</Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
