<p align="center">
  <br>
  <picture>
    <source media="(prefers-color-scheme: dark)" srcset="docs/assets/logo-dark.png">
    <img src="docs/assets/logo.png" alt="Mote" width="280">
  </picture>
  <br><br>
</p>

<p align="center">
  <strong>Markdown in, URL out.</strong><br>
  将本地 Markdown 文档发布为不可变、难以猜测链接、可直接通过浏览器阅读的在线页面。
</p>

<p align="center">
  <a href="https://github.com/flc1125/mote/actions/workflows/ci.yml"><img src="https://img.shields.io/github/actions/workflow/status/flc1125/mote/ci.yml?branch=main&style=flat-square" alt="CI"></a>
  <a href="https://www.npmjs.com/package/mote-cli"><img src="https://img.shields.io/npm/v/mote-cli?style=flat-square" alt="npm"></a>
  <a href="https://www.npmjs.com/package/mote-cli"><img src="https://img.shields.io/npm/dm/mote-cli?style=flat-square" alt="npm downloads"></a>
  <a href="LICENSE"><img src="https://img.shields.io/badge/License-MIT-blue?style=flat-square" alt="License: MIT"></a>
  <a href="https://nodejs.org"><img src="https://img.shields.io/badge/node-%E2%89%A5%2020-brightgreen?style=flat-square" alt="Node ≥ 20"></a>
</p>

<p align="center">
  <a href="#-快速开始">快速开始</a> •
  <a href="https://mote.pub/MxNfTmvTNxMnrbkU">在线示例</a> •
  <a href="docs/zh-CN/README.md">文档导航</a> •
  <a href="docs/zh-CN/self-hosting.md">自托管</a> •
  <a href="README.md">English</a>
</p>

---

## ✨ 特性

- 🔒 **不可变**：每次发布生成全新 URL，已存储的 Markdown 和已上传资产不可更新
- 🔑 **能力 URL（Capability URL）**：知道链接即可阅读，94 bit 随机 ID 防猜测，页面发送禁止索引指令
- 🖼️ **本地图片**：自动上传、按内容去重，公开 URL 不泄露原始文件名
- ⚡ **快**：Cloudflare Workers + R2 + CDN 缓存；无数据库，文档内容在服务端渲染
- 🤖 **Agent 友好**：CLI `--json` 输出，另有远程与本地 MCP server

可访问性取决于实例和存储持续运行。Viewer 更新可能改变呈现效果，远程图片依赖其来源站点。搜索引擎指令不构成访问控制，也不是绝对不被收录的保证。

## 🚀 快速开始

可以从终端、AI Agent 或两者同时使用 Mote——选择适合你工作流的方式。

### CLI

准备 Node.js 20+，并确认你已获准向 `https://mote.pub` 发布。创建 `hello.md`，写入 `# Hello, Mote`，然后在文件所在目录运行：

```bash
npm install -g mote-cli
mote login
mote hello.md
```

```text
Published:

https://mote.pub/7Vk3mQ9x2NFaP4Ls
```

<sub>在线示例 → [包含图片、表格与代码的项目周报](https://mote.pub/MxNfTmvTNxMnrbkU) · [Markdown 源文件](docs/examples/weekly-report.md)</sub>

打开返回的 URL 即可阅读页面。上方 URL 仅展示输出格式，每次发布都会生成新 ID。

需要选择实例或了解登录步骤？见[首次发布教程](docs/zh-CN/quick-start.md)。自有 Access 实例使用 `mote login --api https://mote.example.com --auth-mode oauth` 登录；实例选择和其他鉴权模式见[鉴权指南](docs/zh-CN/authentication.md)。

完整参数、配置、脚本用法及源码安装见 [CLI 参考](docs/zh-CN/cli.md)。

### MCP

将 Agent 接入远程 MCP endpoint——在 Access 实例上通过 OAuth 鉴权：

```json
{
  "mcpServers": {
    "mote": {
      "type": "http",
      "url": "https://mote.pub/api/mcp"
    }
  }
}
```

另有本地 stdio server，额外提供 `publish_markdown_file`（自动上传本地图片）。配置、工具说明与已验证客户端见 [MCP 指南（英文）](docs/mcp.md)。

### Skill

教 Agent 何时、如何用 Mote 发布：

```bash
npx skills add flc1125/mote
```

Skill 通过驱动 CLI 或 MCP 工具完成发布——详见 [Skill 指南（英文）](docs/skill.md)。

## 📝 Markdown 支持

支持表格、任务列表、提示块与折叠、内容标签页、代码标题与行高亮、图片尺寸与图注、
文本高亮、定义列表、缩写及脚注，也支持中文加粗兼容、数学公式和有明确边界的
Mermaid 图表。服务端渲染的正文在无 JavaScript 时仍可阅读；受 CSP 限制的固定脚本
增强目录与标签导航、代码复制、图片查看及脚注预览。文档内容不能执行脚本。

[兼容性说明与限制](docs/zh-CN/markdown.md) · [在线兼容性案例](https://mote.pub/PBqEnukxpQrkamSi) · [Markdown 源文件（英文）](docs/examples/markdown-compatibility.md)

## 🏠 自托管

在 Cloudflare 部署自己的实例：[自托管指南](docs/zh-CN/self-hosting.md)，其中包含免费额度与容量说明。

## 📏 限制

| 项             | 限制                           |
| -------------- | ------------------------------ |
| Markdown       | ≤ 2 MiB                        |
| 单个图片       | ≤ 10 MiB                       |
| 整个文档包     | ≤ 20 MiB                       |
| 上传资产数量   | ≤ 50                           |
| 支持的图片格式 | png / jpeg / webp / gif / avif |

1 MiB = 1,048,576 字节。CLI 按内容去重后计算资产数量，远程图片不计入。文档包大小为 Markdown 与已上传图片的字节数之和，详见[精确限额](docs/protocol.md#大小与数量限额)。

不支持上传 SVG 图片或直接嵌入 SVG；Mermaid 图表使用独立净化的静态生成 SVG。

## 📚 文档

- [文档导航](docs/zh-CN/README.md) · [首次发布教程](docs/zh-CN/quick-start.md)
- [CLI 参考](docs/zh-CN/cli.md) · [鉴权指南](docs/zh-CN/authentication.md) · [MCP 指南（英文）](docs/mcp.md) · [Skill（英文）](docs/skill.md) · [Markdown 兼容性](docs/zh-CN/markdown.md)
- [自托管指南](docs/zh-CN/self-hosting.md) · [部署操作手册](docs/zh-CN/deployment.md)
- [架构](docs/architecture.md)
- [发布协议](docs/protocol.md)
- [安全模型](docs/security.md)
- [迁移记录](docs/zh-CN/migrations.md) · [Changelog（英文）](CHANGELOG.md)
- [贡献指南（英文）](CONTRIBUTING.md) · [漏洞报告政策](SECURITY.md#中文)

> 生产 Worker 由 Cloudflare Workers Builds 随 `main` 部署。GitHub Actions 负责 CI 和稳定标签的 CLI/GitHub Release 发布，详见[部署操作手册](docs/zh-CN/deployment.md)。

## 📄 License

Mote 基于 [MIT License](LICENSE) 发布。
