<p align="center">
  <picture>
    <source media="(prefers-color-scheme: dark)" srcset="docs/assets/logo-dark.png">
    <img src="docs/assets/logo.png" alt="Mote" width="240">
  </picture>
</p>

[English](README.md)

# Mote

[![CI](https://github.com/flc1125/mote/actions/workflows/ci.yml/badge.svg)](https://github.com/flc1125/mote/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)

> **Mote = Markdown in, URL out.**
>
> 将本地 Markdown 文档发布为不可枚举、永久有效、可直接通过浏览器阅读的在线页面。

```bash
mote README.md
```

```text
Published:

https://mote.flc.io/7Vk3mQ9x2NFaP4Ls
```

## 特性

- **不可变**：每次发布生成全新 URL，旧 URL 永久保持原内容
- **Capability URL**：URL 即访问凭证，94 bit 随机 ID 不可枚举，不被搜索引擎收录
- **本地图片**：自动上传、按内容去重，公开 URL 不泄露原始文件名
- **快**：Cloudflare Workers + R2 + CDN 缓存；无数据库，页面零 JS
- **Agent 友好**：CLI `--json` 输出，另有远程与本地 MCP server

## 快速开始

```bash
npm install -g mote-cli
```

<details><summary>从源码构建（需要 Node.js ≥ 20 与 pnpm）</summary>

```bash
git clone https://github.com/flc1125/mote.git
cd mote
pnpm install
pnpm --filter @mote/cli build
cd apps/cli && npm install -g .
```

</details>

配置 token（来自你的 Mote 实例，见[自托管指南](docs/self-hosting.md)）：

```bash
export MOTE_TOKEN="你的 token"
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
https://mote.flc.io/7Vk3mQ9x2NFaP4Ls
```

## 使用

- **CLI**：参数（`--json`、`--no-assets`、`--api`、`--token` 等）、配置文件、脚本用法见 [docs/cli.md](docs/cli.md)
- **MCP**：远程端点（Claude.ai / Codex / 通用客户端）与本地 stdio server 见 [docs/mcp.md](docs/mcp.md)
- **Skill**：教 Agent 何时/如何用 Mote（`npx skills add flc1125/mote`）见 [docs/skill.md](docs/skill.md)
- **自托管**：在 Cloudflare 免费额度内部署自己的实例，见 [docs/self-hosting.md](docs/self-hosting.md)

## 限制

| 项             | 限制                           |
| -------------- | ------------------------------ |
| Markdown       | ≤ 2 MB                         |
| 单个图片       | ≤ 10 MB                        |
| 整个文档包     | ≤ 20 MB                        |
| 图片数量       | ≤ 50                           |
| 支持的图片格式 | png / jpeg / webp / gif / avif |

不支持 SVG（Active Content 风险）。发布后不可修改——修改内容请重新发布得到新 URL。

## 文档

- [CLI 参考](docs/cli.md)
- [MCP 指南](docs/mcp.md)
- [Skill](docs/skill.md)
- [自托管指南](docs/self-hosting.md)
- [架构](docs/architecture.md)
- [发布协议](docs/protocol.md)
- [安全模型](docs/security.md)
- [漏洞报告政策](SECURITY.md)

## License

[MIT](LICENSE)
