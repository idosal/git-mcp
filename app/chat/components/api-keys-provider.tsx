import { createContext, useContext } from "react";
import type { StorageKey } from "../ai/providers.shared";
import { STORAGE_KEYS } from "../lib/constants";
import { useLocalStorage } from "../lib/hooks/use-local-storage";

const ApiKeysContext = createContext<{
  apiKeys: Partial<Record<StorageKey, string>>;
  setApiKeys: (apiKeys: Partial<Record<StorageKey, string>>) => void;
}>({
  apiKeys: {},
  setApiKeys: () => {},
});

export function ApiKeysProvider({ children }: { children: React.ReactNode }) {
  const [apiKeys, setApiKeys] = useLocalStorage<
    Partial<Record<StorageKey, string>>
  >(STORAGE_KEYS.API_KEYS, {});

  return (
    <ApiKeysContext.Provider value={{ apiKeys, setApiKeys }}>
      {children}
    </ApiKeysContext.Provider>
  );
}

export function useApiKeys() {
  return useContext(ApiKeysContext);
}
