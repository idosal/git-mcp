import Chat from "~/chat/components/chat";
import { ChatSidebar } from "~/chat/components/chat-sidebar";
import { SidebarTrigger } from "~/chat/components/ui/sidebar";
import { MCPProvider } from "~/chat/lib/context/mcp-context";
import { Menu } from "lucide-react";
import { ThemeProvider } from "~/chat/components/theme-provider";
import { SidebarProvider } from "~/chat/components/ui/sidebar";
import { Toaster } from "sonner";
import { useLocalStorage } from "~/chat/lib/hooks/use-local-storage";
import { STORAGE_KEYS } from "~/chat/lib/constants";
import "./chatPage.css";
import { ApiKeysProvider } from "~/chat/components/api-keys-provider";

export default function ChatPage({
  owner,
  repo,
}: {
  owner: string | null;
  repo: string | null;
}) {
  const [sidebarOpen, setSidebarOpen] = useLocalStorage<boolean>(
    STORAGE_KEYS.SIDEBAR_STATE,
    true,
  );
  return (
    <ThemeProvider
      attribute="class"
      defaultTheme="ocean"
      enableSystem={true}
      disableTransitionOnChange
      themes={["light", "dark", "sunset", "black", "ocean"]}
    >
      <ApiKeysProvider>
        <SidebarProvider
          defaultOpen={sidebarOpen}
          open={sidebarOpen}
          onOpenChange={setSidebarOpen}
        >
          <MCPProvider owner={owner || "docs"} repo={repo || null}>
            <div className="flex h-dvh w-full">
              <ChatSidebar />
              <main className="flex-1 flex flex-col relative">
                <div className="absolute top-4 left-4 z-50">
                  <SidebarTrigger>
                    <button className="flex items-center justify-center h-8 w-8 bg-muted hover:bg-accent rounded-md transition-colors">
                      <Menu className="h-4 w-4" />
                    </button>
                  </SidebarTrigger>
                </div>
                <Chat />
                <div className="flex-1 flex justify-center"></div>
              </main>
            </div>
          </MCPProvider>
          <Toaster position="top-center" richColors />
        </SidebarProvider>
      </ApiKeysProvider>
    </ThemeProvider>
  );
}
