<p align="center">
  <picture>
    <source media="(prefers-color-scheme: dark)" srcset="docs/assets/logo-dark.png">
    <img src="docs/assets/logo.png" alt="Mote" width="240">
  </picture>
</p>

<h1 align="center">Mote</h1>

<p align="center">
  <strong>Markdown in, URL out.</strong><br>
  将本地 Markdown 文档发布为不可枚举、永久有效、可直接通过浏览器阅读的在线页面。
</p>

<p align="center">
  <a href="https://github.com/flc1125/mote/actions/workflows/ci.yml"><img src="https://github.com/flc1125/mote/actions/workflows/ci.yml/badge.svg" alt="CI"></a>
  <a href="https://www.npmjs.com/package/mote-cli"><img src="https://img.shields.io/npm/v/mote-cli" alt="npm"></a>
  <a href="https://www.npmjs.com/package/mote-cli"><img src="https://img.shields.io/npm/dm/mote-cli" alt="npm downloads"></a>
  <a href="LICENSE"><img src="https://img.shields.io/badge/License-MIT-blue.svg" alt="License: MIT"></a>
  <a href="https://nodejs.org"><img src="https://img.shields.io/badge/node-%E2%89%A5%2020-brightgreen" alt="Node ≥ 20"></a>
</p>

<p align="center">
  <a href="#-快速开始">快速开始</a> •
  <a href="https://mote.flc.io/1tAPUJjNt67GQ2pS">在线示例</a> •
  <a href="docs/self-hosting.md">自托管</a> •
  <a href="README.md">English</a>
</p>

---

```bash
mote README.md
```

```text
Published:

https://mote.example.com/7Vk3mQ9x2NFaP4Ls
```

<p align="center">
  <sub>以上为示意输出——可查看真实的<a href="https://mote.flc.io/1tAPUJjNt67GQ2pS">公开文档与图片样本</a>。</sub>
</p>

## ✨ 特性

|                    |                                                                                  |
| ------------------ | -------------------------------------------------------------------------------- |
| 🔒 **不可变**      | 每次发布生成全新 URL，旧 URL 永久保持原内容                                       |
| 🔑 **Capability URL** | URL 即访问凭证——94 bit 随机 ID 不可枚举，不被搜索引擎收录                       |
| 🖼️ **本地图片**    | 自动上传、按内容去重，公开 URL 不泄露原始文件名                                   |
| ⚡ **快**          | Cloudflare Workers + R2 + CDN 缓存；无数据库，页面零 JS                           |
| 🤖 **Agent 友好**  | CLI `--json` 输出，另有远程与本地 MCP server                                      |

## 🚀 快速开始

```bash
npm install -g mote-cli
```

> **注意**——浏览器登录和 Service Token 鉴权需要 **mote-cli ≥ 0.2.0**。旧 npm 版本不包含这些命令。

<details><summary><strong>从源码构建</strong>（需要 Node.js ≥ 20 与 pnpm）</summary>

```bash
git clone https://github.com/flc1125/mote.git
cd mote
pnpm install
pnpm --filter @mote/cli build
cd apps/cli && npm install -g .
```

</details>

### Access 实例

```bash
mote login
mote README.md
```

默认实例 `https://mote.flc.io` 仅允许获准的发布者。自有 Access 实例使用 `mote login --api https://mote.example.com --auth-mode oauth`。登录成功后会记住实例；显式环境变量和配置仍优先。配置、迁移及验证范围见[鉴权指南](docs/authentication.md)。

### 静态 token 实例

配置你自己的 token 模式实例及 token（见[自托管指南](docs/self-hosting.md)），将示例域名替换为实际域名。静态 token 不能用于向生产 `mote.flc.io` 发布：

```bash
export MOTE_API_URL="https://mote.example.com"
export MOTE_TOKEN="你的 token"
export MOTE_AUTH_MODE="token"
```

发布：

```bash
mote README.md
```

```text
Scanning README.md...

Markdown    47.1 KB
Assets      3
Total       1.84 MB

Published:
https://mote.example.com/7Vk3mQ9x2NFaP4Ls
```

## 📖 使用

|          |                                                                                                        |
| -------- | ------------------------------------------------------------------------------------------------------ |
| **CLI**  | 参数（`--json`、`--no-assets`、`--api`、`--token` 等）、配置文件、脚本用法 → [docs/cli.md](docs/cli.md) |
| **MCP**  | 远程 OAuth 与本地 stdio 工具，配置及兼容性 → [docs/mcp.md](docs/mcp.md)                                |
| **Skill** | 教 Agent 何时/如何用 Mote（`npx skills add flc1125/mote`）→ [docs/skill.md](docs/skill.md)             |
| **自托管** | 在 Cloudflare 免费额度内部署自己的实例 → [docs/self-hosting.md](docs/self-hosting.md)                  |

## 📏 限制

| 项             | 限制                           |
| -------------- | ------------------------------ |
| Markdown       | ≤ 2 MB                         |
| 单个图片       | ≤ 10 MB                        |
| 整个文档包     | ≤ 20 MB                        |
| 图片数量       | ≤ 50                           |
| 支持的图片格式 | png / jpeg / webp / gif / avif |

不支持 SVG（Active Content 风险）。发布后不可修改——修改内容请重新发布得到新 URL。

## 📚 文档

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

---

<p align="center">
  基于 <a href="LICENSE">MIT License</a> 发布。<br>
  <sub>Copyright © flc1125</sub>
</p>
