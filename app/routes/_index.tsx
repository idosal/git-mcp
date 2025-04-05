import { Github, Code, Globe, Zap } from "lucide-react";

export default function Home() {
  return (
    <div className="min-h-screen bg-gray-900 text-gray-100">
      {/* GitHub Link */}
      <div className="absolute top-4 right-4 sm:top-6 sm:right-6 z-10">
        <a
          href="https://github.com/idosal/git-mcp"
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-2 bg-gray-800 hover:bg-gray-700 text-gray-200 px-3 py-2 rounded-md transition-colors duration-200 border border-gray-700 z-10"
        >
          <Github className="h-5 w-5" />
          <span className="hidden sm:inline">GitHub</span>
        </a>
      </div>

      {/* Hero Section */}
      <div className="relative overflow-hidden">
        <div className="absolute inset-0 bg-grid-gray-800 [mask-image:linear-gradient(0deg,rgba(17,24,39,0.7),rgba(17,24,39,0.5))] bg-[length:20px_20px]"></div>
        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-16 sm:pb-6">
          <div className="text-center">
            <div className="flex justify-center">
              <img
                src="/img/icon_cropped.png"
                alt="GitMCP Logo"
                className="h-auto w-56 sm:w-80"
              />
            </div>
            <h1 className="max-w-4xl mx-auto text-4xl sm:text-5xl md:text-[72px] font-bold tracking-tight my-6 bg-gradient-to-r from-blue-500 via-emerald-400 to-purple-500 text-gradient animate-gradient-x">
              GitMCP
            </h1>
            <p className="max-w-3xl mx-auto text-lg sm:text-xl md:text-3xl font-light tracking-tight text-gray-300/90 leading-relaxed">
              Instantly create a{" "}
              <span className="text-emerald-400 font-medium">
                Remote MCP server
              </span>{" "}
              for any GitHub project
            </p>
          </div>
        </div>
      </div>

      {/* How It Works Section */}
      <section id="how-it-works" className="py-8 bg-gray-900 pt-0">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-8 sm:mb-16">
            <div className="mt-0 max-w-3xl mx-auto sm:mt-6">
              <div className="bg-gray-800 border border-gray-700 rounded-lg p-3 sm:p-4 mb-6 sm:mb-8 flex flex-col sm:flex-row items-center">
                <div className="flex-1 flex items-center justify-center sm:justify-end text-gray-300 text-sm sm:text-lg font-mono px-2 sm:px-4 mb-2 sm:mb-0">
                  github.com/username/repo
                </div>
                <div className="mx-2 sm:mx-4 text-gray-500 transform rotate-90 sm:rotate-0">
                  →
                </div>
                <div className="flex-1 flex items-center justify-center sm:justify-start text-emerald-400 text-sm sm:text-lg font-mono px-2 sm:px-4">
                  <b>gitmcp.io</b>/username/repo
                </div>
              </div>
              <div className="bg-gray-800 border border-gray-700 rounded-lg p-3 sm:p-4 mb-6 sm:mb-8 flex flex-col sm:flex-row items-center">
                <div className="flex-1 flex items-center justify-center sm:justify-end text-gray-300 text-sm sm:text-lg font-mono px-2 sm:px-4 mb-2 sm:mb-0">
                  username.github.io/repo
                </div>
                <div className="mx-2 sm:mx-4 text-gray-500 transform rotate-90 sm:rotate-0">
                  →
                </div>
                <div className="flex-1 flex items-center justify-center sm:justify-start text-emerald-400 text-sm sm:text-lg font-mono px-2 sm:px-4">
                  username.<b>gitmcp.io</b>/repo
                </div>
              </div>
              <p className="text-base sm:text-xl text-gray-300 max-w-3xl mx-auto font-light px-2">
                Simply change the domain from{" "}
                <span className="text-gray-200 font-medium">github.com</span> or{" "}
                <span className="text-gray-200 font-medium">github.io</span> to{" "}
                <span className="text-emerald-400 font-medium">gitmcp.io</span>{" "}
                and get instant AI context for any GitHub repository.
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 sm:gap-8">
            <div className="bg-gray-800 p-4 sm:p-6 rounded-xl border border-gray-700 transform transition-all duration-300 hover:translate-y-[-5px] hover:shadow-xl hover:shadow-emerald-900/20">
              <div className="w-10 h-10 bg-blue-600 text-white rounded-full flex items-center justify-center mb-4 sm:mb-5 font-bold mx-auto">
                1
              </div>
              <h3 className="text-lg sm:text-xl font-semibold mb-2 sm:mb-3 text-center">
                Create MCP URL
              </h3>
              <p className="text-sm sm:text-base text-gray-400 text-center">
                Replace{" "}
                <code className="bg-gray-700 px-1.5 py-0.5 rounded">
                  github.com
                </code>{" "}
                with{" "}
                <code className="bg-gray-700 px-1.5 py-0.5 rounded text-emerald-400">
                  gitmcp.io
                </code>{" "}
                in any repository URL.
              </p>
            </div>

            <div className="bg-gray-800 p-4 sm:p-6 rounded-xl border border-gray-700 transform transition-all duration-300 hover:translate-y-[-5px] hover:shadow-xl hover:shadow-emerald-900/20">
              <div className="w-10 h-10 bg-blue-600 text-white rounded-full flex items-center justify-center mb-4 sm:mb-5 font-bold mx-auto">
                2
              </div>
              <h3 className="text-lg sm:text-xl font-semibold mb-2 sm:mb-3 text-center">
                Add to AI Assistant
              </h3>
              <p className="text-sm sm:text-base text-gray-400 text-center">
                Configure your AI tool to use the GitMCP URL as a custom MCP
                server.
              </p>
            </div>

            <div className="bg-gray-800 p-4 sm:p-6 rounded-xl border border-gray-700 transform transition-all duration-300 hover:translate-y-[-5px] hover:shadow-xl hover:shadow-emerald-900/20">
              <div className="w-10 h-10 bg-blue-600 text-white rounded-full flex items-center justify-center mb-4 sm:mb-5 font-bold mx-auto">
                3
              </div>
              <h3 className="text-lg sm:text-xl font-semibold mb-2 sm:mb-3 text-center">
                Enhanced AI Coding
              </h3>
              <p className="text-sm sm:text-base text-gray-400 text-center">
                Your AI now understands your repository's context for more
                accurate and helpful responses.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Video Demo Section */}
      <section id="github-pages-demo" className="py-8 bg-gray-900">
        <div className="text-center mb-4 sm:mb-4">
          <h2 className="text-2xl sm:text-3xl font-bold bg-gradient-to-r from-emerald-400 to-blue-500 text-gradient">
            With GitHub Pages
          </h2>
          <p className="mt-4 text-base sm:text-xl text-gray-300 max-w-3xl mx-auto font-light px-2">
            GitMCP works seamlesslywith <b>GitHub Pages</b>. Here's an example:
          </p>
        </div>
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="relative rounded-xl overflow-hidden shadow-2xl border border-gray-700">
            <video className="w-full h-auto" controls muted loop playsInline>
              <source src="./img/GitMCP_final.mp4" type="video/mp4" />
              Your browser does not support the video tag.
            </video>
          </div>
        </div>
      </section>

      {/* Video PW Demo Section */}
      <section id="github-repo-demo" className="py-8 bg-gray-900">
        <div className="text-center mb-4 sm:mb-4">
          <h2 className="text-2xl sm:text-3xl font-bold bg-gradient-to-r from-emerald-400 to-blue-500 text-gradient">
            A GitHub Repo
          </h2>
          <p className="mt-4 text-base sm:text-xl text-gray-300 max-w-3xl mx-auto font-light px-2">
            GitMCP works with <b>any public GitHub repository</b>. Here's an
            example:
          </p>
        </div>
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="relative rounded-xl overflow-hidden shadow-2xl border border-gray-700">
            <video className="w-full h-auto" controls muted loop playsInline>
              <source src="./img/GitMCP_PW.mp4" type="video/mp4" />
              Your browser does not support the video tag.
            </video>
          </div>
        </div>
      </section>

      {/* What is GitMCP Section */}
      <section className="py-10 sm:py-16 bg-gray-800">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-10 sm:mb-16">
            <h2 className="text-2xl sm:text-3xl font-bold bg-gradient-to-r from-emerald-400 to-blue-500 text-gradient">
              What is GitMCP?
            </h2>
            <p className="mt-4 text-base sm:text-xl text-gray-300 max-w-3xl mx-auto font-light px-2">
              GitMCP creates a dedicated Model Context Protocol (MCP) server for
              any GitHub project, enabling AI assistants to understand your code
              in context.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 sm:gap-8">
            <div className="bg-gray-900 p-4 sm:p-6 rounded-xl border border-gray-700">
              <div className="w-12 h-12 bg-blue-900 rounded-lg flex items-center justify-center mb-4">
                <Code className="h-5 w-5 sm:h-6 sm:w-6 text-blue-400" />
              </div>
              <h3 className="text-lg sm:text-xl font-semibold mb-2 text-gray-100">
                Code Understanding
              </h3>
              <p className="text-sm sm:text-base text-gray-400">
                AI assistants gain a deep context of the code repo, reading{" "}
                <span className="text-blue-400">llms.txt</span>,{" "}
                <span className="text-blue-400">llms-full.txt</span>,{" "}
                <span className="text-blue-400">readme.md</span> and more,
                making their responses more accurate and relevant.
              </p>
            </div>

            <div className="bg-gray-900 p-4 sm:p-6 rounded-xl border border-gray-700">
              <div className="w-12 h-12 bg-emerald-900 rounded-lg flex items-center justify-center mb-4">
                <Zap className="h-5 w-5 sm:h-6 sm:w-6 text-emerald-400" />
              </div>
              <h3 className="text-lg sm:text-xl font-semibold mb-2 text-gray-100">
                Instant Setup
              </h3>
              <p className="text-sm sm:text-base text-gray-400">
                No complex configuration needed. Just point to your GitHub
                repository and connect your AI tools.
              </p>
            </div>

            <div className="bg-gray-900 p-4 sm:p-6 rounded-xl border border-gray-700">
              <div className="w-12 h-12 bg-purple-900 rounded-lg flex items-center justify-center mb-4">
                <Globe className="h-5 w-5 sm:h-6 sm:w-6 text-purple-400" />
              </div>
              <h3 className="text-lg sm:text-xl font-semibold mb-2 text-gray-100">
                Universal Access
              </h3>
              <p className="text-sm sm:text-base text-gray-400">
                Works seamlessly with any public GitHub repository and GitHub
                Pages, making your documentation and code accessible to AI
                tools.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Compatible With Section */}
      <section className="py-10 sm:py-16 bg-gray-800">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-8 sm:mb-12">
            <h2 className="text-2xl sm:text-3xl font-bold bg-gradient-to-r from-purple-400 to-emerald-500 text-gradient">
              Compatible With
            </h2>
            <p className="mt-4 text-base sm:text-xl text-gray-300 max-w-3xl mx-auto font-light">
              Works with all popular MCP-compatible AI tools
            </p>
          </div>

          <div className="flex flex-wrap justify-center gap-8 sm:gap-16 items-center">
            <div className="flex flex-col items-center">
              <a
                href="https://claude.ai"
                target="_blank"
                rel="noopener noreferrer"
                className="group hover:opacity-90 transition-opacity flex flex-col items-center"
              >
                <div className="w-16 h-16 sm:w-20 sm:h-20 bg-gradient-to-br from-gray-700 to-gray-800 rounded-xl shadow-lg flex items-center justify-center mb-3 group-hover:from-gray-650 group-hover:to-gray-750 transition-all">
                  <img
                    src="https://claude.ai/favicon.ico"
                    alt="Claude"
                    className="h-8 w-8 sm:h-10 sm:w-10"
                  />
                </div>
                <span className="text-gray-200 text-base sm:text-lg font-medium">
                  Claude
                </span>
              </a>
            </div>

            <div className="flex flex-col items-center">
              <a
                href="https://cursor.com"
                target="_blank"
                rel="noopener noreferrer"
                className="group hover:opacity-90 transition-opacity flex flex-col items-center"
              >
                <div className="w-16 h-16 sm:w-20 sm:h-20 bg-gradient-to-br from-gray-700 to-gray-800 rounded-xl shadow-lg flex items-center justify-center mb-3 group-hover:from-gray-650 group-hover:to-gray-750 transition-all">
                  <img
                    src="https://www.cursor.com/favicon.ico"
                    alt="Cursor"
                    className="h-8 w-8 sm:h-10 sm:w-10"
                  />
                </div>
                <span className="text-gray-200 text-base sm:text-lg font-medium">
                  Cursor
                </span>
              </a>
            </div>

            <div className="flex flex-col items-center">
              <a
                href="https://codeium.com/windsurf"
                target="_blank"
                rel="noopener noreferrer"
                className="group hover:opacity-90 transition-opacity flex flex-col items-center"
              >
                <div className="w-16 h-16 sm:w-20 sm:h-20 bg-gradient-to-br from-gray-700 to-gray-800 rounded-xl shadow-lg flex items-center justify-center mb-3 group-hover:from-gray-650 group-hover:to-gray-750 transition-all">
                  <img
                    src="https://codeium.com/favicon.ico"
                    alt="Windsurf"
                    className="h-8 w-8 sm:h-10 sm:w-10"
                  />
                </div>
                <span className="text-gray-200 text-base sm:text-lg font-medium">
                  Windsurf
                </span>
              </a>
            </div>

            <div className="flex flex-col items-center">
              <a
                href="https://code.visualstudio.com/"
                target="_blank"
                rel="noopener noreferrer"
                className="group hover:opacity-90 transition-opacity flex flex-col items-center"
              >
                <div className="w-16 h-16 sm:w-20 sm:h-20 bg-gradient-to-br from-gray-700 to-gray-800 rounded-xl shadow-lg flex items-center justify-center mb-3 group-hover:from-gray-650 group-hover:to-gray-750 transition-all">
                  <img
                    src="https://code.visualstudio.com/assets/favicon.ico"
                    alt="VSCode"
                    className="h-8 w-8 sm:h-10 sm:w-10"
                  />
                </div>
                <span className="text-gray-200 text-base sm:text-lg font-medium">
                  VSCode
                </span>
              </a>
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-gray-950 text-gray-400 py-8 sm:py-12">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col md:flex-row justify-between items-center">
            <div className="mb-6 md:mb-0">
              <div className="text-xl sm:text-2xl font-bold mb-2">
                <span className="text-blue-400">Git</span>
                <span className="text-emerald-400">MCP</span>
              </div>
              <p className="text-sm sm:text-base text-gray-500">
                © 2025 GitMCP. All rights reserved.
              </p>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
