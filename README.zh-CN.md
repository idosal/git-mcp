# GitMCP

<div align="center">
  <a href="README.md">English</a> • 
  <a href="README.zh-CN.md">中文</a>
</div>

<p align="center">
  <img width="884" alt="image" src="https://github.com/user-attachments/assets/2bf3e3df-556c-49c6-ab7b-36c279d53bba" />
</p>

<p align="center">
  <a href="#-什么是-gitmcp">什么是 GitMCP</a> •
  <a href="#-功能特性">功能特性</a> •
  <a href="#-快速开始">快速开始</a> •
  <a href="#-工作原理">工作原理</a> •
  <a href="#-徽章">徽章</a> •
  <a href="#-使用示例">使用示例</a> •
  <a href="#-常见问题">常见问题</a> •
  <a href="#-隐私保护">隐私保护</a> •
  <a href="#-贡献指南">贡献指南</a> •
  <a href="#-许可证">许可证</a>
</p>
<div align="center">

[![GitMCP](https://img.shields.io/endpoint?url=https://gitmcp.io/badge/idosal/git-mcp)](https://gitmcp.io/idosal/git-mcp)
[![Twitter Follow](https://img.shields.io/twitter/follow/idosal1?style=social)](https://twitter.com/idosal1)
[![Twitter Follow](https://img.shields.io/twitter/follow/liadyosef?style=social)](https://twitter.com/liadyosef)
</div>

<div align="center">
  <a href="https://www.pulsemcp.com/servers/idosal-git-mcp"><img src="https://www.pulsemcp.com/badge/top-pick/idosal-git-mcp" width="400" alt="Pulse MCP Badge"></a>
</div>

## 🤔 什么是 GitMCP？
**停止幻觉，开始真正的编程！**

[GitMCP](https://gitmcp.io) 是一个免费、开源的远程 [模型上下文协议 (MCP)](https://docs.anthropic.com/en/docs/agents-and-tools/mcp) 服务器，它将**任何** GitHub 项目（仓库或 GitHub Pages）转换为文档中心。它使 Cursor 等 AI 工具能够访问最新的文档和代码，即使 LLM 从未遇到过它们，从而无缝地消除代码幻觉。

GitMCP 支持**两种模式**：

*   **特定仓库 (`gitmcp.io/{owner}/{repo}` 或 `{owner}.gitmcp.io/{repo}`)：** 当您主要使用少数几个库时使用这些。这确保您的 AI 助手始终针对正确的项目，通过防止访问意外仓库来增强安全性和相关性。
*   **通用服务器 (`gitmcp.io/docs`)：** 当您需要频繁在不同仓库之间切换时，使用此选项获得最大灵活性。AI 助手将提示您（或根据上下文决定）每次请求要访问哪个仓库。请注意，这依赖于每次都正确识别目标仓库。

**使用 GitMCP：**

*   AI 助手直接从源访问*最新*的文档和代码。
*   获得准确的 API 使用方法和可靠的代码示例。
*   即使使用小众、新出现或快速变化的库也能有效工作。
*   显著减少幻觉并提高代码正确性。

例如，这个并排比较显示了在 Cursor 中创建 [three.js](https://github.com/mrdoob/three.js) 场景时相同一次性提示的结果：

https://github.com/user-attachments/assets/fbf1b4a7-f9f0-4c0e-831c-4d64faae2c45

## ✨ 功能特性

- 😎 **任意 GitHub 项目的最新文档**：为您的 AI 助手提供对 GitHub 项目文档和代码的无缝访问。内置的智能搜索功能帮助找到 AI 需要的精确内容，而不会使用太多 token！
- 🧠 **不再有幻觉**：使用 GitMCP，您的 AI 助手可以提供准确且相关的答案。
- ☁️ **零设置**：GitMCP 在云端运行。只需在您的 IDE 中将选定的 GitMCP URL 添加为 MCP 服务器——无需下载、安装、注册或更改。
- 💬 **嵌入式聊天**：通过我们浏览器内的聊天功能直接与仓库文档聊天，快速开始！
- ✅ **开放、免费且私密**：GitMCP 是开源的，完全免费使用。它不收集个人信息或存储查询。您甚至可以自行托管！

<video src="https://github.com/user-attachments/assets/2c3afaf9-6c08-436e-9efd-db8710554430"></video>

## 🚀 快速开始

使用 GitMCP 很简单！只需按照以下步骤操作：

### 步骤 1：选择您想要的服务器类型

根据您想要连接的内容选择以下 URL 格式之一：

- 对于 GitHub 仓库：`gitmcp.io/{owner}/{repo}`
- 对于 GitHub Pages 站点：`{owner}.gitmcp.io/{repo}`
- 对于支持任意仓库的通用工具（动态）：`gitmcp.io/docs`

将 `{owner}` 替换为 GitHub 用户名或组织名称，将 `{repo}` 替换为仓库名称。

为了方便您使用，您还可以使用着陆页上的转换工具将 GitHub URL 格式化为 MCP URL！

### 步骤 2：连接您的 AI 助手

从下面的选项中选择您的 AI 助手并按照配置说明操作：

#### 连接 Cursor

更新您的 Cursor 配置文件 `~/.cursor/mcp.json`：
   ```json
   {
     "mcpServers": {
       "gitmcp": {
         "url": "https://gitmcp.io/{owner}/{repo}"
       }
     }
   }
   ```

#### 连接 Claude Desktop

1. 在 Claude Desktop 中，转到设置 > 开发者 > 编辑配置
2. 用以下配置替换：
   ```json
   {
     "mcpServers": {
       "gitmcp": {
         "command": "npx",
         "args": [
           "mcp-remote",
           "https://gitmcp.io/{owner}/{repo}"
         ]
       }
     }
   }
   ```

#### 连接 Windsurf

更新您的 Windsurf 配置文件 `~/.codeium/windsurf/mcp_config.json`：
   ```json
   {
     "mcpServers": {
       "gitmcp": {
         "serverUrl": "https://gitmcp.io/{owner}/{repo}"
       }
     }
   }
   ```

#### 连接 VSCode

更新您的 VSCode 配置文件 `.vscode/mcp.json`：
   ```json
   {
     "servers": {
       "gitmcp": {
         "type": "sse",
         "url": "https://gitmcp.io/{owner}/{repo}"
       }
     }
   }
   ```

#### 连接 Cline

更新您的 Cline 配置文件 `~/Library/Application Support/Code/User/globalStorage/saoudrizwan.claude-dev/settings/cline_mcp_settings.json`：
   ```json
   {
     "mcpServers": {
       "gitmcp": {
         "url": "https://gitmcp.io/{owner}/{repo}",
         "disabled": false,
         "autoApprove": []
       }
     }
   }
   ```

#### 连接 Highlight AI

1. 打开 Highlight AI 并点击侧边栏中的插件图标（@ 符号）
2. 点击侧边栏顶部的**已安装插件**
3. 选择**自定义插件**
4. 点击**使用自定义 SSE URL 添加插件**

插件名称：`gitmcp`
SSE URL：`https://gitmcp.io/{owner}/{repo}`

有关向 HighlightAI 添加自定义 MCP 服务器的更多详细信息，请参阅[文档](https://docs.highlightai.com/learn/developers/plugins/custom-plugins-setup)。

#### 连接 Augment Code

1. 打开 Augment Code 设置
2. 导航到 MCP 部分
3. 添加一个新的 MCP 服务器，详细信息如下：

将 MCP 服务器命名为：`git-mcp Docs`

使用此命令：
```bash
npx mcp-remote https://gitmcp.io/{owner}/{repo}
```

或使用以下配置：
```json
{
  "mcpServers": {
    "git-mcp Docs": {
      "command": "npx",
      "args": [
        "mcp-remote",
        "https://gitmcp.io/{owner}/{repo}"
      ]
    }
  }
}
```

#### 连接 Msty AI
1. 打开 Msty Studio
2. 转到工具 > 从 JSON 剪贴板导入工具
3. 粘贴以下配置：

```json
{
  "mcpServers": {
    "git-mcp Docs": {
      "command": "npx",
      "args": [
        "mcp-remote",
        "https://gitmcp.io/{owner}/{repo}"
      ]
    }
  }
}
```

有关在 Augment Code 中配置 MCP 服务器的更多详细信息，请访问 [Augment Code 文档](https://docs.augmentcode.com/setup-augment/mcp)。

> **注意：** 请记住将 `{owner}` 和 `{repo}` 替换为实际的 GitHub 用户名/组织和仓库名称。您也可以使用动态端点 `https://gitmcp.io/docs` 来允许您的 AI 按需访问任何仓库。

## ⚙ 工作原理

GitMCP 使用模型上下文协议 (MCP) 将您的 AI 助手连接到 GitHub 仓库，这是一个允许 AI 工具从外部源请求额外信息的标准。

当您使用 GitMCP 时会发生什么：

1. **您向 AI 助手提供 GitMCP URL**（例如，`gitmcp.io/microsoft/typescript`）。GitMCP 暴露文档获取、智能搜索、代码搜索等工具。
2. **向 AI 助手提出文档/代码相关问题**。
3. **您的 AI 向 GitMCP 发送请求**以使用其工具（需要您的批准）。
4. **GitMCP 执行 AI 的请求**并返回请求的数据。
5. **您的 AI 接收信息**并生成更准确、有根据的响应，没有幻觉。

### 支持的文档

GitMCP 目前支持以下文档（按优先级排序）：
1. [llms.txt](https://llmstxt.org)
2. 项目的 AI 优化版本文档
3. `README.md`/根目录

## 💡 使用示例

以下是如何将 GitMCP 与不同 AI 助手和仓库一起使用的示例：

### 示例 1：使用 Windsurf 与特定仓库

对于 GitHub 仓库 `https://github.com/microsoft/playwright-mcp`，将 `https://gitmcp.io/microsoft/playwright-mcp` 添加为 Windsurf 的 MCP 服务器。

**向 Claude 的提示：**
> "如何使用 Playwright MCP"

Windsurf 将从 GitMCP 拉取相关文档以正确实现内存功能。

### 示例 2：使用 Cursor 与 GitHub Pages 站点

对于 GitHub Pages 站点 `langchain-ai.github.io/langgraph`，将 `https://langchain-ai.gitmcp.io/langgraph` 添加为 Cursor 的 MCP 服务器。

**向 Cursor 的提示：**
> "为我的 LangGraph 代理添加内存"

Cursor 将从 GitMCP 拉取相关文档和代码以正确实现内存功能。

### 示例 3：使用 Claude Desktop 与动态端点

您不必选择特定仓库。通用 `gitmcp.io/docs` 端点允许 AI 动态选择 GitHub 项目！

**向任何 AI 助手的提示：**
> "我想了解 OpenAI Whisper 语音识别模型。解释它是如何工作的。"

Claude 将从 GitMCP 拉取数据并回答问题。

## 🛠️ 工具

GitMCP 为 AI 助手提供了几个有价值的工具，帮助它们访问、理解和查询 GitHub 仓库。

### `fetch_<repo-name>_documentation`

此工具从 GitHub 仓库获取主要文档。它通过检索相关文档（例如，`llms.txt`）来工作。这为 AI 提供了项目概述。

**何时有用：** 对于关于项目目的、功能或如何开始的一般性问题

### `search_<repo-name>_documentation`

此工具允许 AI 通过提供特定搜索查询来搜索仓库的文档。它不使用智能搜索来加载所有文档（可能非常大），而是只找到相关部分。

**何时有用：** 对于关于项目中特定功能、函数或概念的具体问题

### `fetch_url_content`

此工具帮助 AI 从文档中提到的链接获取信息。它检索这些链接的内容并将其转换为 AI 易于阅读的格式。

**何时有用：** 当文档引用有助于回答问题的外部信息时

### `search_<repo-name>_code`

此工具使用 GitHub 的代码搜索功能搜索仓库中的实际代码。它帮助 AI 找到特定的代码示例或实现细节。

**何时有用：** 当您想要如何实现某事的示例或需要文档中未涵盖的技术细节时

> **注意：** 使用动态端点（`gitmcp.io/docs`）时，这些工具的名称略有不同（`fetch_generic_documentation`、`search_generic_code` 和 `search_generic_documentation`），并且需要关于访问哪个仓库的额外信息。

## 📊 徽章

GitMCP 为您的仓库 README 提供了一个徽章。它允许用户通过他们的 IDE 或浏览器（使用嵌入式聊天）快速访问您的文档。它还展示了通过 GitMCP 访问您文档的次数。

示例（`idosal/git-mcp`）：[![GitMCP](https://img.shields.io/endpoint?url=https://gitmcp.io/badge/idosal/git-mcp)](https://gitmcp.io/idosal/git-mcp)

### 将徽章添加到您的仓库

在您的 `README.md` 中添加以下内容：

```markdown
[![GitMCP](https://img.shields.io/endpoint?url=https://gitmcp.io/badge/OWNER/REPO)](https://gitmcp.io/OWNER/REPO)
```

将 `OWNER` 替换为您的 GitHub 用户名或组织，将 `REPO` 替换为您的仓库名称。

### 我们如何计算浏览量

对特定仓库的每次工具调用都会增加计数。

### 自定义徽章

您可以使用参数自定义徽章的外观：

| 参数 | 描述 | 默认值 | 示例 |
|------|------|--------|------|
| `color` | 徽章值的颜色 | `aquamarine` | `?color=green` |
| `label` | 徽章标签 | `GitMCP` | `Documentation`

如有问题，请联系我们！

## ❓ 常见问题

### 什么是模型上下文协议？

[模型上下文协议](https://modelcontextprotocol.io/introduction)是一个标准，允许 AI 助手以结构化方式从外部源请求和接收额外上下文，从而增强其理解和性能。

### GitMCP 是否适用于任何 AI 助手？

是的，GitMCP 与支持模型上下文协议的任何 AI 助手兼容，包括 Cursor、VSCode、Claude 等工具。

### GitMCP 是否与所有 GitHub 项目兼容？

绝对可以！GitMCP 适用于任何公共 GitHub 仓库，无需任何修改。它优先使用 `llms.txt` 文件，如果前者不可用，则回退到 `README.md` 或其他页面。未来的更新旨在支持额外的文档方法，甚至动态生成内容。

### GitMCP 需要付费吗？

不，GitMCP 是面向社区的免费服务，没有任何相关费用。

## 🔒 隐私保护

GitMCP 深深致力于保护用户隐私。该服务无法访问或存储任何个人身份信息，因为它不需要身份验证。此外，它不存储代理发送的任何查询。而且，由于 GitMCP 是一个开源项目，它可以在您的环境中独立部署。

GitMCP 只访问已经公开可用的内容，并且只在用户查询时访问。GitMCP 不会自动抓取仓库。在访问任何 GitHub Pages 站点之前，代码会检查 `robots.txt` 规则并遵循站点所有者设置的指令，允许他们选择退出。请注意，GitMCP 不会永久存储有关 GitHub 项目或其内容的数据。

## 👥 贡献指南

我们欢迎贡献、反馈和想法！请查看我们的[贡献](https://github.com/idosal/git-mcp/blob/main/.github/CONTRIBUTING.md)指南。

### 本地开发设置

1. **克隆仓库**
   ```bash
   git clone https://github.com/idosal/git-mcp.git
   cd git-mcp
   ```

2. **安装依赖**
   ```bash
   pnpm install
   ```

3. **本地运行开发环境**
   ```bash
   npm run dev
   # 或
   pnpm dev
   ```

#### 使用 MCP Inspector 进行测试

1. 安装 MCP Inspector 工具：
   ```bash
   npx @modelcontextprotocol/inspector
   ```

2. 在检查器界面中：
   - 将传输类型设置为 `SSE`
   - 输入您的 GitMCP URL（例如，`http://localhost:5173/docs`）
   - 点击"连接"

## 📄 许可证

本项目根据 [Apache License 2.0](LICENSE) 获得许可。

## 免责声明

GitMCP 按"原样"提供，不提供任何形式的保证。虽然我们努力确保服务的可靠性和安全性，但我们不对使用过程中可能产生的任何损害或问题负责。通过 GitMCP 访问的 GitHub 项目受各自所有者的条款和条件约束。GitMCP 与 GitHub 或任何提到的 AI 工具没有关联。

## Star History

[![Star History Chart](https://api.star-history.com/svg?repos=idosal/git-mcp&type=Timeline)](https://www.star-history.com/#idosal/git-mcp&Timeline)
