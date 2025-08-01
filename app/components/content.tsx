import React, { useState } from "react";
import { ClipboardCopy, Check, Github } from "lucide-react";
import type { UrlType } from "../../src/shared/repoData";
import { generateServerName } from "../../src/shared/nameUtils";

export default function Content({
  urlType,
  owner,
  repo,
  url,
}: {
  urlType: UrlType;
  owner?: string | null;
  repo?: string | null;
  url?: string;
}) {
  const [activeTabIndex, setActiveTabIndex] = useState(0);

  let documentationServerPrefix = "GitMCP";
  let docsText = owner === "docs" ? "all GitHub docs" : `${owner}/${repo} docs`;
  let serverName = generateServerName(repo);

  if (owner == "cloudflare" && repo == "docs") {
    url = "https://docs.mcp.cloudflare.com/sse";
    documentationServerPrefix = "MCP";
    docsText = "Cloudflare docs";
    serverName = "Cloudflare Docs";
  }

  const description: React.ReactNode = (() => {
    if (owner == "cloudflare" && repo == "docs") {
      return (
        <div>
          <span> for</span>{" "}
          <strong className="text-blue-500">
            <a
              href={`https://developers.cloudflare.com/`}
              target="_blank"
              rel="noopener noreferrer"
              className="text-blue-500 hover:underline"
            >
              Cloudflare Documentation
            </a>
          </strong>{" "}
        </div>
      );
    }

    if (urlType === "subdomain") {
      return (
        <div>
          <span> for the</span>{" "}
          <strong className="text-blue-500">
            <a
              href={`https://github.com/${owner}/${repo}`}
              target="_blank"
              rel="noopener noreferrer"
              className="text-blue-500 hover:underline"
            >
              {owner}/{repo}
            </a>
          </strong>{" "}
          <span>GitHub Pages</span>
        </div>
      );
    } else if (owner && repo) {
      return (
        <div>
          <span> for the</span>{" "}
          <strong className="text-blue-500">
            <a
              href={`https://github.com/${owner}/${repo}`}
              target="_blank"
              rel="noopener noreferrer"
              className="text-blue-500 hover:underline"
            >
              {owner}/{repo}
            </a>
          </strong>{" "}
          <span>GitHub repository</span>
        </div>
      );
    }
    return <div>Documentation MCP</div>;
  })();

  const [copied, setCopied] = useState(false);

  const copyUrl = () => {
    navigator.clipboard.writeText(url || "");
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  // Function to get favicon URL for different tools
  const getToolFaviconUrl = (toolName: string): string => {
    switch (toolName) {
      case "Cursor":
        return "https://www.cursor.com/favicon.ico";
      case "Claude Desktop":
        return "https://claude.ai/favicon.ico";
      case "Windsurf":
        return "https://codeium.com/favicon.ico";
      case "VSCode":
        return "https://code.visualstudio.com/assets/favicon.ico";
      case "Cline":
        return "https://cline.bot/assets/branding/favicons/favicon-32x32.png";
      case "Highlight AI":
        return "https://highlightai.com/favicon.ico";
      case "Augment Code":
        return "https://cdn.prod.website-files.com/66d76c2202b335e39ad2b5e8/66f302d663108ca67c19ddbc_Favicon.png";
      case "Msty AI":
        return "https://msty.studio/favicon.ico";
      default:
        return "https://codeium.com/favicon.ico";
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 to-slate-100 flex flex-col items-center p-8 px-4 sm:px-8 relative">
      {/* GitHub Link */}
      <div className="absolute top-4 right-4 sm:top-6 sm:right-6 z-10">
        <a
          href="https://github.com/idosal/git-mcp"
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-2 bg-white hover:bg-gray-50 text-gray-800 px-3 py-2 rounded-md transition-colors duration-200 border border-gray-200 shadow-sm z-10"
        >
          <Github className="h-5 w-5" />
          <span className="hidden sm:inline">GitHub</span>
        </a>
      </div>
      <div className="max-w-3xl w-full">
        <div className="text-center mb-8">
          <h1 className="text-xl sm:text-4xl font-bold mb-2 relative inline-block">
            <a
              href="https://gitmcp.io"
              className="text-blue-800 hover:text-blue-600 transition-colors"
              target="_blank"
              rel="noopener noreferrer"
            >
              {documentationServerPrefix} Documentation Server
            </a>
          </h1>
          <div className="mt-4 text-lg sm:text-xl text-slate-700">
            {description}
          </div>
          <div className="flex items-center justify-center mt-6">
            <div className="h-0.5 w-12 bg-slate-300"></div>
            <div className="mx-4">
              <svg
                width="24"
                height="24"
                viewBox="0 0 24 24"
                fill="none"
                xmlns="http://www.w3.org/2000/svg"
              >
                <path
                  fillRule="evenodd"
                  clipRule="evenodd"
                  d="M12 2C6.477 2 2 6.477 2 12C2 16.418 4.865 20.166 8.839 21.489C9.339 21.581 9.5 21.278 9.5 21.017C9.5 20.756 9.5 20.178 9.5 19.317C6.739 19.939 6.139 17.917 6.139 17.917C5.699 16.778 5.039 16.478 5.039 16.478C4.119 15.839 5.099 15.839 5.099 15.839C6.099 15.917 6.659 16.917 6.659 16.917C7.5 18.5 9.099 17.958 9.5 17.698C9.6 17.078 9.859 16.65 10.14 16.417C7.98 16.166 5.699 15.306 5.699 11.489C5.699 10.389 6.099 9.489 6.7 8.789C6.58 8.539 6.22 7.489 6.8 6.122C6.8 6.122 7.62 5.85 9.5 7.122C10.3 6.872 11.15 6.75 12 6.75C12.85 6.75 13.7 6.872 14.5 7.122C16.38 5.85 17.2 6.122 17.2 6.122C17.78 7.489 17.42 8.539 17.3 8.789C17.9 9.489 18.3 10.389 18.3 11.489C18.3 15.306 16.02 16.166 13.86 16.417C14.14 16.65 14.4 17.139 14.4 17.839C14.4 18.917 14.4 20.656 14.4 21.017C14.4 21.278 14.56 21.581 15.06 21.489C19.137 20.166 22 16.418 22 12C22 6.477 17.523 2 12 2Z"
                  fill="#2563EB"
                />
              </svg>
            </div>
            <div className="h-0.5 w-12 bg-slate-300"></div>
          </div>
        </div>

        {/* a button - NEW! Chat with `${owner}/${repo}` docs! */}
        <div className="my-8 ">
          <div className="flex justify-center">
            <div className="relative group">
              <div className="absolute rounded-lg blur opacity-75 group-hover:opacity-100 transition duration-300 group-hover:duration-200"></div>
              <button
                className="cursor-pointer relative px-6 py-3 bg-gradient-to-br from-blue-600 to-purple-700 hover:from-blue-500 hover:to-purple-600 text-white font-bold text-lg rounded-lg shadow-lg transform hover:scale-105 transition-all duration-200 flex items-center"
                onClick={() =>
                  window.open(
                    owner === "docs" ? "/docs/chat" : `/${owner}/${repo}/chat`,
                    "_blank",
                  )
                }
              >
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  className="h-5 w-5 mr-2"
                  viewBox="0 0 20 20"
                  fill="currentColor"
                >
                  <path
                    fillRule="evenodd"
                    d="M18 10c0 3.866-3.582 7-8 7a8.841 8.841 0 01-4.083-.98L2 17l1.338-3.123C2.493 12.767 2 11.434 2 10c0-3.866 3.582-7 8-7s8 3.134 8 7zM7 9H5v2h2V9zm8 0h-2v2h2V9zM9 9h2v2H9V9z"
                    clipRule="evenodd"
                  />
                </svg>
                <span className="hidden sm:inline">
                  New! Chat with {docsText} online!
                </span>
                <span className="sm:hidden">Chat with docs</span>
              </button>
            </div>
          </div>
        </div>

        <div className="bg-white shadow-lg rounded-lg p-4 sm:p-6 my-8 border border-slate-200">
          <h2 className="text-lg sm:text-xl font-semibold text-blue-800 mb-4">
            MCP Server URL
          </h2>
          <div className="bg-slate-50 border border-slate-200 rounded-lg p-3 flex items-center justify-between mb-2 relative">
            <code className="text-slate-700 pr-10 break-all text-xs sm:text-lg">
              {url}
            </code>
            <button
              onClick={copyUrl}
              className="absolute right-2 p-1.5 rounded-full hover:bg-slate-200 transition-colors"
              aria-label="Copy URL"
            >
              {copied ? (
                <Check className="w-5 h-5 text-emerald-500" />
              ) : (
                <ClipboardCopy className="w-5 h-5 text-blue-600" />
              )}
            </button>
          </div>
          {copied && (
            <p className="text-emerald-500 text-sm">URL copied to clipboard!</p>
          )}
        </div>

        <div className="bg-white shadow-lg rounded-lg p-4 sm:p-6 my-8 border border-slate-200">
          <h2 className="text-lg sm:text-xl font-semibold text-blue-800 mb-4">
            Connect your AI assistant
          </h2>

          {/* Tabs for different integrations */}
          <div className="mb-6">
            <div className="flex flex-wrap border-b border-slate-200 mb-4">
              {[
                "Cursor",
                "Claude Desktop",
                "Windsurf",
                "VSCode",
                "Cline",
                "Highlight AI",
                "Augment Code",
                "Msty AI",
              ].map((tab, index) => (
                <button
                  key={tab}
                  className={`py-2 px-3 sm:px-4 font-medium text-xs sm:text-sm focus:outline-none cursor-pointer ${
                    activeTabIndex === index
                      ? "text-blue-600 border-b-2 border-blue-600"
                      : "text-slate-600 hover:text-blue-600"
                  }`}
                  onClick={(e) => {
                    setActiveTabIndex(index);

                    // Hide all tab contents
                    document
                      .querySelectorAll(".tab-content")
                      .forEach((content) => {
                        content.classList.add("hidden");
                      });

                    // Show the selected tab content
                    document
                      .getElementById(
                        `tab-${tab.replace(/\s+/g, "-").toLowerCase()}`,
                      )
                      ?.classList.remove("hidden");
                  }}
                >
                  <div className="flex items-center">
                    <img
                      src={getToolFaviconUrl(tab)}
                      alt={tab}
                      className="h-4 w-4 mr-2 inline-block"
                    />
                    <span
                      className={`${
                        activeTabIndex === index ? "inline" : "hidden"
                      } sm:inline`}
                    >
                      {tab}
                    </span>
                  </div>
                </button>
              ))}
            </div>

            {/* Tab content */}
            <div id="tab-cursor" className="tab-content">
              <div className="bg-slate-50 p-3 sm:p-4 rounded-md border border-slate-200">
                <p className="text-sm text-slate-700 mb-2">
                  To add this MCP to Cursor, update your{" "}
                  <code className="bg-slate-200 px-1.5 py-0.5 rounded text-blue-700 break-words">
                    ~/.cursor/mcp.json
                  </code>
                  :
                </p>
                <CodeExample
                  code={`{
  "mcpServers": {
    "${serverName}": {
      "url": "${url}"
    }
  }
}`}
                  id="cursor"
                  name="Cursor"
                  popoutUrl="cursor://mcp-remote?url=${url}"
                />
              </div>
            </div>

            <div id="tab-claude-desktop" className="tab-content hidden">
              <div className="bg-slate-50 p-3 sm:p-4 rounded-md border border-slate-200">
                <p className="text-sm text-slate-700 mb-2">
                  To add this MCP to Claude Desktop, update your{" "}
                  <code className="bg-slate-200 px-1.5 py-0.5 rounded text-blue-700 break-words">
                    claude_desktop_config.json
                  </code>
                  :
                </p>
                <CodeExample
                  code={`{
  "mcpServers": {
    "${serverName}": {
      "command": "npx",
      "args": [
        "mcp-remote",
        "${url}"
      ]
    }
  }
}`}
                  id="claude"
                  name="Claude Desktop"
                  popoutUrl="claude://"
                />
              </div>
            </div>

            <div id="tab-windsurf" className="tab-content hidden">
              <div className="bg-slate-50 p-3 sm:p-4 rounded-md border border-slate-200">
                <p className="text-sm text-slate-700 mb-2">
                  To add this MCP to Windsurf, update your{" "}
                  <code className="bg-slate-200 px-1.5 py-0.5 rounded text-blue-700 break-words">
                    ~/.codeium/windsurf/mcp_config.json
                  </code>
                  :
                </p>
                <CodeExample
                  code={`{
  "mcpServers": {
    "${serverName}": {
      "serverUrl": "${url}"
    }
  }
}`}
                  id="windsurf"
                  popoutUrl="windsurf://"
                  name="Windsurf"
                />
              </div>
            </div>
            <div id="tab-vscode" className="tab-content hidden">
              <div className="bg-slate-50 p-3 sm:p-4 rounded-md border border-slate-200">
                <p className="text-sm text-slate-700 mb-2">
                  To add this MCP to VSCode, update your{" "}
                  <code className="bg-slate-200 px-1.5 py-0.5 rounded text-blue-700 break-words">
                    .vscode/mcp.json
                  </code>
                  :
                </p>
                <CodeExample
                  code={`{
  "servers": {
    "${serverName}": {
      "type": "sse",
      "url": "${url}"
    }
  }
}`}
                  id="vscode"
                  name="VSCode Insiders"
                  popoutUrl={`vscode://mcp-remote?url=${url}`}
                />
              </div>
            </div>

            <div id="tab-cline" className="tab-content hidden">
              <div className="bg-slate-50 p-3 sm:p-4 rounded-md border border-slate-200">
                <p className="text-sm text-slate-700 mb-2">
                  To add this MCP to Cline, update your{" "}
                  <code className="bg-slate-200 px-1.5 py-0.5 rounded text-blue-700 break-words">
                    ~/Library/Application
                    Support/Code/User/globalStorage/saoudrizwan.claude-dev/settings/cline_mcp_settings.json
                  </code>
                  :
                </p>
                <CodeExample
                  code={`{
  "mcpServers": {
    "${serverName}": {
      "url": "${url}",
      "disabled": false,
      "autoApprove": []
    }
  }
}`}
                  id="cline"
                  name="Cline"
                />
              </div>
            </div>

            <div id="tab-highlight-ai" className="tab-content hidden">
              <div className="bg-slate-50 p-3 sm:p-4 rounded-md border border-slate-200">
                <div className="p-4">
                  <ul className="text-sm text-slate-700 mb-4 list-disc pl-5 space-y-2">
                    <li>
                      Open Highlight AI and click the plugins icon (@ symbol) in
                      the sidebar
                    </li>
                    <li>
                      Click <strong>Installed Plugins</strong> at the top of the
                      sidebar
                    </li>
                    <li>
                      Select <strong>Custom Plugin</strong>
                    </li>
                    <li>
                      Click <strong>Add a plugin using a custom SSE URL</strong>
                    </li>
                  </ul>

                  <div className="my-6">
                    <img
                      src="/img/highlight-add-custom-plugin.png"
                      alt="Highlight AI Add Custom Plugin"
                      className="w-full rounded shadow-md"
                    />
                  </div>

                  <p className="text-sm text-slate-700 mb-4">
                    Enter this as your plugin name:{" "}
                    <code className="bg-slate-200 px-2 py-1 rounded text-blue-700 break-words block my-3">
                      {serverName}
                    </code>
                  </p>

                  <p className="text-sm text-slate-700 mb-4">
                    Enter this URL as the SSE URL:{" "}
                    <code className="bg-slate-200 px-2 py-1 rounded text-blue-700 break-words block my-3">
                      {url}
                    </code>
                  </p>

                  <div className="my-6">
                    <img
                      src="/img/highlight-sse-plugin-setup.png"
                      alt="Highlight AI MCP"
                      className="w-full rounded shadow-md"
                    />
                  </div>

                  <p className="text-sm text-slate-700 mt-4">
                    For more details on adding custom MCP servers, refer to{" "}
                    <a
                      href="https://docs.highlightai.com/learn/developers/plugins/custom-plugins-setup"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-blue-600 hover:text-blue-800"
                    >
                      the documentation
                    </a>
                    .
                  </p>
                </div>
              </div>
            </div>

            <div id="tab-augment-code" className="tab-content hidden">
              <div className="bg-slate-50 p-3 sm:p-4 rounded-md border border-slate-200">
                <div className="p-4">
                  <ul className="text-sm text-slate-700 mb-4 list-disc pl-5 space-y-2">
                    <li>Open Augment Code settings</li>
                    <li>Navigate to the MCP section</li>
                    <li>Add a new MCP server with the following details</li>
                  </ul>

                  <p className="text-sm text-slate-700 mb-4">
                    Name the MCP server:{" "}
                    <code className="bg-slate-200 px-2 py-1 rounded text-blue-700 break-words block my-3">
                      git-mcp Docs
                    </code>
                  </p>

                  <p className="text-sm text-slate-700 mb-4">
                    Use this command:{" "}
                    <code className="bg-slate-200 px-2 py-1 rounded text-blue-700 break-words block my-3">
                      npx mcp-remote ${url}
                    </code>
                  </p>

                  <p className="text-sm text-slate-700 mb-4">
                    Or use the following configuration:{" "}
                  </p>

                  <CodeExample
                    code={`{
  "mcpServers": {
    "git-mcp Docs": {
      "command": "npx",
      "args": [
        "mcp-remote",
        "${url}"
      ]
    }
  }
}`}
                    id="augment-code"
                    name="Augment Code"
                  />

                  <p className="text-sm text-slate-700 mt-4">
                    For more details on configuring MCP servers in Augment Code,
                    visit{" "}
                    <a
                      href="https://docs.augmentcode.com/setup-augment/mcp"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-blue-600 hover:text-blue-800"
                    >
                      the Augment Code documentation
                    </a>
                    .
                  </p>
                </div>
              </div>
            </div>

            <div id="tab-msty-ai" className="tab-content hidden">
              <div className="bg-slate-50 p-3 sm:p-4 rounded-md border border-slate-200">
                <ul className="text-sm text-slate-700 mb-4 list-disc pl-5 space-y-2">
                  <li>Copy the following JSON configuration: </li>
                  <CodeExample
                    code={`{
                      "mcpServers": {
                        "${serverName}": {
                          "command": "npx",
                          "args": [
                            "mcp-remote",
                            "${url}"
                          ]
                        }
                      }
                    }`}
                    id="msty-ai"
                    name="Msty AI"
                  />
                  <li>
                    Go to Msty Studio &gt; Tools &gt; 'Import Tools from JSON
                    Clipboard'
                  </li>
                </ul>
                <p className="text-sm text-slate-700 mb-4">
                  For more details on using Msty AI, refer to{" "}
                  <a
                    href="https://docs.msty.ai"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-blue-600 hover:text-blue-800"
                  >
                    the documentation
                  </a>
                  .
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Footer with tool links */}
        <div className="mt-8 flex flex-col items-center justify-center">
          <div className="flex justify-center space-x-8 mb-6">
            <a
              href="https://claude.ai"
              className="text-blue-600 hover:text-blue-800 flex items-center transition-colors"
              target="_blank"
              rel="noopener noreferrer"
            >
              <img
                src={getToolFaviconUrl("Claude Desktop")}
                alt="Claude"
                className="h-6 w-6 mr-2"
              />
              Claude
            </a>
            <a
              href="https://cursor.com"
              className="text-blue-600 hover:text-blue-800 flex items-center transition-colors"
              target="_blank"
              rel="noopener noreferrer"
            >
              <img
                src={getToolFaviconUrl("Cursor")}
                alt="Cursor"
                className="h-6 w-6 mr-2"
              />
              Cursor
            </a>
            <a
              href="https://codeium.com/windsurf"
              className="text-blue-600 hover:text-blue-800 flex items-center transition-colors"
              target="_blank"
              rel="noopener noreferrer"
            >
              <img
                src={getToolFaviconUrl("Windsurf")}
                alt="Windsurf"
                className="h-6 w-6 mr-2"
              />
              Windsurf
            </a>
            <a
              href="https://code.visualstudio.com/"
              className="text-blue-600 hover:text-blue-800 flex items-center transition-colors"
              target="_blank"
              rel="noopener noreferrer"
            >
              <img
                src="https://code.visualstudio.com/assets/favicon.ico"
                alt="VSCode"
                className="h-6 w-6 mr-2"
              />
              VSCode
            </a>
          </div>
          <div className="flex justify-center space-x-8">
            <a
              href="https://cline.tools"
              className="text-blue-600 hover:text-blue-800 flex items-center transition-colors"
              target="_blank"
              rel="noopener noreferrer"
            >
              <img
                src={getToolFaviconUrl("Cline")}
                alt="Cline"
                className="h-6 w-6 mr-2"
              />
              Cline
            </a>
            <a
              href="https://highlightai.com"
              className="text-blue-600 hover:text-blue-800 flex items-center transition-colors"
              target="_blank"
              rel="noopener noreferrer"
            >
              <img
                src={getToolFaviconUrl("Highlight AI")}
                alt="Highlight AI"
                className="h-6 w-6 mr-2"
              />
              Highlight AI
            </a>
            <a
              href="https://augmentcode.com"
              className="text-blue-600 hover:text-blue-800 flex items-center transition-colors"
              target="_blank"
              rel="noopener noreferrer"
            >
              <img
                src={getToolFaviconUrl("Augment Code")}
                alt="Augment Code"
                className="h-6 w-6 mr-2"
              />
              Augment Code
            </a>
            <a
              href="https://msty.ai"
              className="text-blue-600 hover:text-blue-800 flex items-center transition-colors"
              target="_blank"
              rel="noopener noreferrer"
            >
              <img
                src={getToolFaviconUrl("Msty AI")}
                alt="Msty AI"
                className="h-6 w-6 mr-2"
              />
              Msty AI
            </a>
          </div>
        </div>
      </div>
    </div>
  );
}

function CodeExample({
  code,
  id,
  name,
  popoutUrl,
}: {
  code: string;
  id: string;
  name: string;
  popoutUrl?: string;
}) {
  return (
    <div className="bg-slate-800 text-slate-100 p-3 rounded-md text-sm overflow-x-auto relative">
      <button
        onClick={() => {
          navigator.clipboard.writeText(code);
          const copyBtn = document.querySelector(`#${id}-copy-btn`);
          if (copyBtn) {
            copyBtn.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="text-emerald-500"><polyline points="20 6 9 17 4 12"></polyline></svg>`;
            setTimeout(() => {
              copyBtn.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path></svg>`;
            }, 2000);
          }
        }}
        id={`${id}-copy-btn`}
        className="absolute top-2 right-2 p-1 rounded-md hover:bg-slate-700 transition-colors focus:outline-none z-10"
        aria-label="Copy code"
      >
        <svg
          xmlns="http://www.w3.org/2000/svg"
          width="16"
          height="16"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>
          <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
        </svg>
      </button>
      {popoutUrl && (
        <button
          onClick={() => {
            window.open(popoutUrl);
          }}
          id={`${id}-open-btn`}
          className="absolute top-2 right-8 p-1 rounded-md hover:bg-slate-700 transition-colors focus:outline-none z-10"
          aria-label={`Open ${name}`}
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"></path>
            <polyline points="15 3 21 3 21 9"></polyline>
            <line x1="10" y1="14" x2="21" y2="3"></line>
          </svg>
        </button>
      )}
      <pre className="bg-slate-800 text-slate-100 rounded-md text-sm overflow-x-auto relative">
        {code}
      </pre>
    </div>
  );
}
