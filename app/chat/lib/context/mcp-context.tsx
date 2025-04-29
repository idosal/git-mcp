"use client";

import React, {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import { useLocalStorage } from "~/chat/lib/hooks/use-local-storage";
import { STORAGE_KEYS } from "~/chat/lib/constants";

// Define types for MCP server
export interface KeyValuePair {
  key: string;
  value: string;
}

export interface MCPServer {
  id: string;
  name: string;
  url: string;
  type: "sse" | "stdio";
  command?: string;
  args?: string[];
  env?: KeyValuePair[];
  headers?: KeyValuePair[];
  description?: string;
  isFixed?: boolean;
}

// Type for processed MCP server config for API
export interface MCPServerApi {
  type: "sse" | "stdio";
  url: string;
  command?: string;
  args?: string[];
  env?: KeyValuePair[];
  headers?: KeyValuePair[];
}

interface MCPContextType {
  mcpServers: MCPServer[];
  setMcpServers: (servers: MCPServer[]) => void;
  selectedMcpServers: string[];
  setSelectedMcpServers: (serverIds: string[]) => void;
  mcpServersForApi: MCPServerApi[];
  owner: string;
  repo: string | null;
  serverNameText: string;
}

const MCPContext = createContext<MCPContextType | undefined>(undefined);

export function MCPProvider(props: {
  children: React.ReactNode;
  owner: string;
  repo: string | null;
  persist?: boolean;
}) {
  const { children, owner, repo, persist = false } = props;
  const [mcpServersFromLocalStorage, setMcpServersFromLocalStorage] =
    useLocalStorage<MCPServer[]>(STORAGE_KEYS.MCP_SERVERS, []);
  const [
    selectedMcpServersFromLocalStorage,
    setSelectedMcpServersFromLocalStorage,
  ] = useLocalStorage<string[]>(STORAGE_KEYS.SELECTED_MCP_SERVERS, []);

  const [mcpServersFromState, setMcpServersFromState] = useState<MCPServer[]>(
    [],
  );
  const [selectedMcpServersFromState, setSelectedMcpServersFromState] =
    useState<string[]>([]);

  const { serverNameText, serverUrl, serverName } = useMemo(() => {
    const repoName = repo || "";
    if (owner == "cloudflare" && repoName == "docs") {
      return {
        serverNameText: "Cloudflare docs",
        serverUrl: "https://docs.mcp.cloudflare.com/sse",
        serverName: "Cloudflare Docs",
      };
    }
    return {
      serverNameText: repoName ? `${repoName} docs` : "Github docs",
      serverUrl: ["https://gitmcp.io", owner, repo].filter(Boolean).join("/"),
      serverName: repoName ? `${repoName} Docs` : "MCP Docs",
    };
  }, [owner, repo]);

  const gitMcpServer = useMemo<MCPServer>(() => {
    return {
      id: ["gitMcp", owner, repo].filter(Boolean).join("-"),
      name: serverName,
      url: serverUrl,
      type: "sse",
      isFixed: true,
    };
  }, [owner, repo]);

  const {
    mcpServers,
    setMcpServers,
    selectedMcpServers,
    setSelectedMcpServers,
  } = useMemo(() => {
    if (persist) {
      return {
        mcpServers: [
          gitMcpServer,
          ...mcpServersFromLocalStorage.filter(
            (server) => server.id !== gitMcpServer.id,
          ),
        ],
        setMcpServers: setMcpServersFromLocalStorage,
        selectedMcpServers: [
          gitMcpServer.id,
          ...selectedMcpServersFromLocalStorage.filter(
            (id) => id !== gitMcpServer.id,
          ),
        ],
        setSelectedMcpServers: setSelectedMcpServersFromLocalStorage,
      };
    }
    return {
      mcpServers: [
        gitMcpServer,
        ...mcpServersFromState.filter(
          (server) => server.id !== gitMcpServer.id,
        ),
      ],
      setMcpServers: setMcpServersFromState,
      selectedMcpServers: [
        gitMcpServer.id,
        ...selectedMcpServersFromState.filter((id) => id !== gitMcpServer.id),
      ],
      setSelectedMcpServers: setSelectedMcpServersFromState,
    };
  }, [
    persist,
    mcpServersFromLocalStorage,
    setMcpServersFromLocalStorage,
    mcpServersFromState,
    setMcpServersFromState,
    selectedMcpServersFromState,
    setSelectedMcpServersFromState,
    selectedMcpServersFromLocalStorage,
    setSelectedMcpServersFromLocalStorage,
    gitMcpServer,
  ]);

  const [mcpServersForApi, setMcpServersForApi] = useState<MCPServerApi[]>([]);

  // Process MCP servers for API consumption whenever server data changes
  useEffect(() => {
    if (!selectedMcpServers.length) {
      setMcpServersForApi([]);
      return;
    }

    const processedServers: MCPServerApi[] = selectedMcpServers
      .map((id) => mcpServers.find((server) => server.id === id))
      .filter((server): server is MCPServer => Boolean(server))
      .map((server) => ({
        type: server.type,
        url: server.url,
        command: server.command,
        args: server.args,
        env: server.env,
        headers: server.headers,
      }));

    setMcpServersForApi(processedServers);
  }, [mcpServers, selectedMcpServers]);

  return (
    <MCPContext.Provider
      value={{
        mcpServers,
        setMcpServers,
        selectedMcpServers,
        setSelectedMcpServers,
        mcpServersForApi,
        owner,
        repo,
        serverNameText,
      }}
    >
      {children}
    </MCPContext.Provider>
  );
}

export function useMCP() {
  const context = useContext(MCPContext);
  if (context === undefined) {
    throw new Error("useMCP must be used within an MCPProvider");
  }
  return context;
}
