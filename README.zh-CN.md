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
  将本地 Markdown 文档发布为不可枚举、永久有效、可直接通过浏览器阅读的在线页面。
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
  <a href="docs/self-hosting.md">自托管</a> •
  <a href="README.md">English</a>
</p>

---

## ✨ 特性

- 🔒 **不可变**：每次发布生成全新 URL，旧 URL 永久保持原内容
- 🔑 **Capability URL**：URL 即访问凭证，94 bit 随机 ID 不可枚举，不被搜索引擎收录
- 🖼️ **本地图片**：自动上传、按内容去重，公开 URL 不泄露原始文件名
- ⚡ **快**：Cloudflare Workers + R2 + CDN 缓存；无数据库，文档内容在服务端渲染
- 🤖 **Agent 友好**：CLI `--json` 输出，另有远程与本地 MCP server

## 🚀 快速开始

可以从终端、AI Agent 或两者同时使用 Mote——选择适合你工作流的方式。

### CLI

```bash
npm install -g mote-cli
mote login
mote README.md
```

```text
Published:

https://mote.example.com/7Vk3mQ9x2NFaP4Ls
```

<sub>在线示例 → [包含图片、表格与代码的项目周报](https://mote.pub/MxNfTmvTNxMnrbkU) · [Markdown 源文件](docs/examples/weekly-report.md)</sub>

默认实例 `https://mote.pub` 仅允许获准的发布者。自有 Access 实例使用 `mote login --api https://mote.example.com --auth-mode oauth`。详见[鉴权指南](docs/authentication.md)。

> **注意**——浏览器登录和 Service Token 鉴权需要 **mote-cli ≥ 0.2.0**。完整参数（`--json`、`--no-assets`、`--api`、`--token` 等）、配置文件与脚本用法见 [docs/cli.md](docs/cli.md)。

<details><summary><strong>从源码构建</strong>（需要 Node.js ≥ 20 与 pnpm）</summary>

```bash
git clone https://github.com/flc1125/mote.git
cd mote
pnpm install
pnpm --filter @mote/cli build
cd apps/cli && npm install -g .
```

</details>

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

另有本地 stdio server，额外提供 `publish_markdown_file`（自动上传本地图片）。配置、工具说明与已验证客户端见 [docs/mcp.md](docs/mcp.md)。

### Skill

教 Agent 何时、如何用 Mote 发布：

```bash
npx skills add flc1125/mote
```

Skill 通过驱动 CLI 或 MCP 工具完成发布——详见 [docs/skill.md](docs/skill.md)。

## 📝 Markdown 支持

支持表格、任务列表、脚注、GitHub 风格提示块、静态代码高亮、中文加粗兼容、
数学公式和有明确边界的 Mermaid 图表。文档内容在服务端渲染，固定的自有脚本在
CSP 限制下增强响应式目录和文档页顶部的 **History** 浮层，可查看当前浏览器最近访问的
20 篇文档并清空记录；文档内容不能执行脚本。

[兼容性说明与限制](docs/markdown.md) · [在线兼容性案例](https://mote.pub/PBqEnukxpQrkamSi) · [Markdown 源文件](docs/examples/markdown-compatibility.md)

## 🏠 自托管

在 Cloudflare 免费额度内部署自己的实例：[docs/self-hosting.md](docs/self-hosting.md)。

## 📏 限制

| 项             | 限制                           |
| -------------- | ------------------------------ |
| Markdown       | ≤ 2 MB                         |
| 单个图片       | ≤ 10 MB                        |
| 整个文档包     | ≤ 20 MB                        |
| 图片数量       | ≤ 50                           |
| 支持的图片格式 | png / jpeg / webp / gif / avif |

不支持上传 SVG 图片或直接嵌入 SVG；Mermaid 图表使用独立净化的静态生成 SVG。

## 📚 文档

- [Markdown 兼容性](docs/markdown.md)
- [CLI 参考](docs/cli.md)
- [鉴权与迁移](docs/authentication.md)
- [MCP 指南](docs/mcp.md)
- [Skill](docs/skill.md)
- [自托管指南](docs/self-hosting.md)
- [部署操作手册](docs/zh-CN/deployment.md)
- [架构](docs/architecture.md)
- [发布协议](docs/protocol.md)
- [安全模型](docs/security.md)
- [漏洞报告政策](SECURITY.md)

> 生产 Worker 由 Cloudflare Workers Builds 随 `main` 部署。GitHub Actions 负责 CI 和稳定标签的 CLI/GitHub Release 发布，详见[部署操作手册](docs/zh-CN/deployment.md)。

## 📄 License

Mote 基于 [MIT License](LICENSE) 发布。
