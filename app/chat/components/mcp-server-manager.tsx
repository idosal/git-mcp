"use client";

import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "./ui/dialog";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { Label } from "./ui/label";
import {
  PlusCircle,
  ServerIcon,
  Globe,
  ExternalLink,
  Trash2,
  CheckCircle,
  Edit2,
} from "lucide-react";
import { toast } from "sonner";
import type { MCPServer } from "~/chat/lib/context/mcp-context";
import { getRepoData } from "~/chat/lib/utils";

// Default template for a new MCP server
const INITIAL_NEW_SERVER: Omit<MCPServer, "id"> = {
  name: "",
  url: "",
  type: "sse",
  command: "node",
  args: [],
  env: [],
  headers: [],
};

interface MCPServerManagerProps {
  servers: MCPServer[];
  onServersChange: (servers: MCPServer[]) => void;
  selectedServers: string[];
  onSelectedServersChange: (serverIds: string[]) => void;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export const MCPServerManager = ({
  servers,
  onServersChange,
  selectedServers,
  onSelectedServersChange,
  open,
  onOpenChange,
}: MCPServerManagerProps) => {
  const [newServer, setNewServer] =
    useState<Omit<MCPServer, "id">>(INITIAL_NEW_SERVER);
  const [view, setView] = useState<"list" | "add">("list");
  const [editingServerId, setEditingServerId] = useState<string | null>(null);

  const resetAndClose = () => {
    setView("list");
    setNewServer(INITIAL_NEW_SERVER);
    onOpenChange(false);
  };

  const generateServerFromUrl = (url: string): MCPServer | null => {
    if (!url) {
      toast.error("Server URL is required");
      return null;
    }

    const { owner, repo } = getRepoData(url);

    if (!owner || (owner != "docs" && !repo)) {
      toast.error("Invalid server URL");
      return null;
    }

    const newUrl = ["https://gitmcp.io", owner, repo].filter(Boolean).join("/");

    const name = repo ? `${repo} Docs` : "MCP Docs";

    const id = crypto.randomUUID();

    return { id, name, url: newUrl, type: "sse" } as const;
  };

  const addServer = () => {
    const newServerToAdd = generateServerFromUrl(newServer.url);
    if (!newServerToAdd) {
      return;
    }
    const updatedServers = [...servers, newServerToAdd];
    onServersChange(updatedServers);

    toast.success(`Added MCP server: ${newServerToAdd.name}`);
    setView("list");
    setNewServer(INITIAL_NEW_SERVER);
  };

  const removeServer = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const updatedServers = servers.filter((server) => server.id !== id);
    onServersChange(updatedServers);

    // If the removed server was selected, remove it from selected servers
    if (selectedServers.includes(id)) {
      onSelectedServersChange(
        selectedServers.filter((serverId) => serverId !== id),
      );
    }

    toast.success("Server removed");
  };

  const toggleServer = (id: string) => {
    if (selectedServers.includes(id)) {
      // Remove from selected servers
      onSelectedServersChange(
        selectedServers.filter((serverId) => serverId !== id),
      );
      const server = servers.find((s) => s.id === id);
      if (server) {
        toast.success(`Disabled MCP server: ${server.name}`);
      }
    } else {
      // Add to selected servers
      onSelectedServersChange([...selectedServers, id]);
      const server = servers.find((s) => s.id === id);
      if (server) {
        toast.success(`Enabled MCP server: ${server.name}`);
      }
    }
  };

  const clearAllServers = () => {
    if (selectedServers.length > 0) {
      onSelectedServersChange([]);
      toast.success("All MCP servers disabled");
      resetAndClose();
    }
  };

  // Editing support
  const startEditing = (server: MCPServer) => {
    setEditingServerId(server.id);
    setNewServer({
      name: server.name,
      url: server.url,
      type: server.type,
      command: server.command,
      args: server.args,
      env: server.env,
      headers: server.headers,
    });
    setView("add");
  };

  const handleFormCancel = () => {
    if (view === "add") {
      setView("list");
      setEditingServerId(null);
      setNewServer(INITIAL_NEW_SERVER);
    } else {
      resetAndClose();
    }
  };

  const updateServer = () => {
    const newServerToUpdate = generateServerFromUrl(newServer.url);
    if (!newServerToUpdate) {
      return;
    }
    const updated = servers.map((s) =>
      s.id === editingServerId
        ? { ...newServerToUpdate, id: editingServerId! }
        : s,
    );
    onServersChange(updated);
    toast.success(`Updated MCP server: ${newServerToUpdate.name}`);
    setView("list");
    setEditingServerId(null);
    setNewServer(INITIAL_NEW_SERVER);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[480px] max-h-[85vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ServerIcon className="h-5 w-5 text-primary" />
            {view == "list"
              ? "MCP Server Configuration"
              : editingServerId
                ? "Edit GitMCP Server"
                : "Add New GitMCP Server"}
          </DialogTitle>
          <DialogDescription>
            {selectedServers.length > 0 && (
              <span className="block mt-1 text-xs font-medium text-primary">
                {selectedServers.length} server
                {selectedServers.length !== 1 ? "s" : ""} currently active
              </span>
            )}
          </DialogDescription>
        </DialogHeader>

        {view === "list" ? (
          <div className="flex-1 overflow-hidden flex flex-col">
            {servers.length > 0 ? (
              <div className="flex-1 overflow-hidden flex flex-col">
                <div className="flex-1 overflow-hidden flex flex-col">
                  <div className="flex items-center justify-between mb-3">
                    <h3 className="text-sm font-medium">Available Servers</h3>
                    <span className="text-xs text-muted-foreground">
                      Select multiple servers to combine their tools
                    </span>
                  </div>
                  <div className="overflow-y-auto pr-1 flex-1 gap-2.5 flex flex-col pb-16">
                    {servers
                      .sort((a, b) => {
                        const aActive = selectedServers.includes(a.id);
                        const bActive = selectedServers.includes(b.id);
                        if (aActive && !bActive) return -1;
                        if (!aActive && bActive) return 1;
                        return 0;
                      })
                      .map((server) => {
                        const isActive = selectedServers.includes(server.id);
                        return (
                          <McpServerListItem
                            key={server.id}
                            server={server}
                            isActive={isActive}
                            removeServer={removeServer}
                            startEditing={startEditing}
                            toggleServer={toggleServer}
                          />
                        );
                      })}
                  </div>
                </div>
              </div>
            ) : (
              <div className="flex-1 py-8 pb-16 flex flex-col items-center justify-center space-y-4">
                <div className="rounded-full p-3 bg-primary/10">
                  <ServerIcon className="h-7 w-7 text-primary" />
                </div>
                <div className="text-center space-y-1">
                  <h3 className="text-base font-medium">
                    No MCP Servers Added
                  </h3>
                  <p className="text-sm text-muted-foreground max-w-[300px]">
                    Add your first MCP server to access additional AI tools
                  </p>
                </div>
                <div className="flex items-center gap-1.5 text-xs text-muted-foreground mt-4">
                  <a
                    href="https://modelcontextprotocol.io"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-1 hover:text-primary transition-colors"
                  >
                    Learn about MCP
                    <ExternalLink className="h-3 w-3" />
                  </a>
                </div>
              </div>
            )}
          </div>
        ) : (
          <div className="space-y-4 overflow-y-auto px-1 py-0.5 mb-14 [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden">
            <div className="space-y-4">
              <div className="grid gap-1.5">
                <Label htmlFor="url" className="pb-1">
                  Server or Repository URL
                </Label>
                <Input
                  id="url"
                  value={newServer.url}
                  onChange={(e) =>
                    setNewServer({ ...newServer, url: e.target.value })
                  }
                  placeholder="https://gitmcp.io/microsoft/playwright-mcp"
                  className="relative z-0 placeholder:text-muted-foreground/60"
                />
                <p className="text-xs text-muted-foreground/80">
                  A gitmcp.io server, a github.com repository, or a github.io
                  pages site
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Persistent fixed footer with buttons */}
        <div className="absolute bottom-0 left-0 right-0 p-4 bg-background border-t border-border flex justify-between z-10">
          {view === "list" ? (
            <>
              <span></span>
              <Button
                onClick={() => setView("add")}
                size="sm"
                className="gap-1.5"
              >
                <PlusCircle className="h-3.5 w-3.5" />
                Add Server
              </Button>
            </>
          ) : (
            <>
              <Button variant="outline" onClick={handleFormCancel}>
                Cancel
              </Button>
              <Button
                onClick={editingServerId ? updateServer : addServer}
                disabled={!newServer.url}
              >
                {editingServerId ? "Save Changes" : "Add Server"}
              </Button>
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};

function McpServerListItem({
  server,
  isActive,
  removeServer,
  startEditing,
  toggleServer,
}: {
  server: MCPServer;
  isActive: boolean;
  removeServer: (id: string, e: React.MouseEvent) => void;
  startEditing: (server: MCPServer) => void;
  toggleServer: (id: string) => void;
}) {
  return (
    <div
      key={server.id}
      className={`
relative flex flex-col p-3.5 rounded-xl transition-colors
border ${
        isActive
          ? "border-primary bg-primary/10"
          : "border-border hover:border-primary/30 hover:bg-primary/5"
      }
`}
    >
      {/* Server Header with Type Badge and Delete Button */}
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <Globe
            className={`h-4 w-4 ${
              isActive ? "text-primary" : "text-muted-foreground"
            } flex-shrink-0`}
          />

          <h4 className="text-sm font-medium truncate max-w-[220px]">
            {server.name}
          </h4>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs px-2 py-0.5 rounded-full bg-secondary text-secondary-foreground">
            {server.type.toUpperCase()}
          </span>
          {!server.isFixed && (
            <>
              <button
                onClick={(e) => removeServer(server.id, e)}
                className="p-1 rounded-full hover:bg-muted/70"
                aria-label="Remove server"
              >
                <Trash2 className="h-3.5 w-3.5 text-muted-foreground" />
              </button>
              <button
                onClick={() => startEditing(server)}
                className="p-1 rounded-full hover:bg-muted/50"
                aria-label="Edit server"
              >
                <Edit2 className="h-3.5 w-3.5 text-muted-foreground" />
              </button>
            </>
          )}
        </div>
      </div>

      {/* Server Details */}
      <p className="text-xs text-muted-foreground mb-2.5 truncate">
        {server.type === "sse"
          ? server.url
          : `${server.command} ${server.args?.join(" ")}`}
      </p>

      {/* Action Button */}
      {!server.isFixed && (
        <Button
          size="sm"
          className="w-full gap-1.5 hover:text-black hover:dark:text-white hover:ocean:text-white rounded-lg"
          variant={isActive ? "default" : "outline"}
          onClick={() => toggleServer(server.id)}
        >
          {isActive && <CheckCircle className="h-3.5 w-3.5" />}
          {isActive ? "Active" : "Enable Server"}
        </Button>
      )}
    </div>
  );
}
