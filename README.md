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
  Publish local Markdown documents as immutable, unguessable, browser-readable web pages.
</p>

<p align="center">
  <a href="https://github.com/flc1125/mote/actions/workflows/ci.yml"><img src="https://img.shields.io/github/actions/workflow/status/flc1125/mote/ci.yml?branch=main&style=flat-square" alt="CI"></a>
  <a href="https://www.npmjs.com/package/mote-cli"><img src="https://img.shields.io/npm/v/mote-cli?style=flat-square" alt="npm"></a>
  <a href="https://www.npmjs.com/package/mote-cli"><img src="https://img.shields.io/npm/dm/mote-cli?style=flat-square" alt="npm downloads"></a>
  <a href="LICENSE"><img src="https://img.shields.io/badge/License-MIT-blue?style=flat-square" alt="License: MIT"></a>
  <a href="https://nodejs.org"><img src="https://img.shields.io/badge/node-%E2%89%A5%2020-brightgreen?style=flat-square" alt="Node ≥ 20"></a>
</p>

<p align="center">
  <a href="#-quick-start">Quick Start</a> •
  <a href="https://mote.pub/MxNfTmvTNxMnrbkU">Live Demo</a> •
  <a href="docs/self-hosting.md">Self-hosting</a> •
  <a href="README.zh-CN.md">简体中文</a>
</p>

---

## ✨ Features

- 🔒 **Immutable** — every publish creates a new URL; old URLs keep their content forever
- 🔑 **Capability URL** — the URL is the only credential; unguessable (94-bit random ID), never indexed
- 🖼️ **Local images** — referenced images are uploaded automatically, deduplicated, and served from opaque URLs
- ⚡ **Fast** — Cloudflare Workers + R2 + CDN cache; no database, server-rendered documents
- 🤖 **Agent-ready** — CLI `--json` output, plus remote and local MCP servers

## 🚀 Quick Start

Use Mote from the terminal, from an AI agent, or both — pick what fits your workflow.

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

<sub>Live sample → [a project update with images, tables, and code](https://mote.pub/MxNfTmvTNxMnrbkU) · [Markdown source](docs/examples/weekly-report.md)</sub>

The default instance, `https://mote.pub`, permits only approved publishers. For your own Access-enabled instance, use `mote login --api https://mote.example.com --auth-mode oauth`. Details: [authentication guide](docs/authentication.md).

> **Note** — Browser login and Service Token authentication require **mote-cli ≥ 0.2.0**. Full options (`--json`, `--no-assets`, `--api`, `--token`, …), config file, and scripting: [docs/cli.md](docs/cli.md).

<details><summary><strong>From source</strong> (requires Node.js ≥ 20 and pnpm)</summary>

```bash
git clone https://github.com/flc1125/mote.git
cd mote
pnpm install
pnpm --filter @mote/cli build
cd apps/cli && npm install -g .
```

</details>

### MCP

Point your agent at the remote MCP endpoint — on Access-enabled instances it authenticates over OAuth:

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

A local stdio server is also available, adding `publish_markdown_file` with automatic local-image upload. Setup, tools, and verified clients: [docs/mcp.md](docs/mcp.md).

### Skill

Teach your agent when and how to publish with Mote:

```bash
npx skills add flc1125/mote
```

The skill drives the CLI or MCP tools — details: [docs/skill.md](docs/skill.md).

## 📝 Markdown support

Tables, task lists, footnotes, GitHub-style alerts, static code highlighting,
Chinese emphasis compatibility, math formulas and a bounded Mermaid subset.
Document content is rendered on the server. A small, CSP-restricted script enhances
the responsive table of contents; document content cannot run scripts.

[Compatibility reference and limits](docs/markdown.md) · [Live compatibility specimen](https://mote.pub/PBqEnukxpQrkamSi) · [Markdown source](docs/examples/markdown-compatibility.md)

## 🏠 Self-hosting

Run your own instance on Cloudflare's free tier: [docs/self-hosting.md](docs/self-hosting.md).

## 📏 Limits

| Item          | Limit                          |
| ------------- | ------------------------------ |
| Markdown      | ≤ 2 MB                         |
| Single image  | ≤ 10 MB                        |
| Whole bundle  | ≤ 20 MB                        |
| Images        | ≤ 50                           |
| Image formats | png / jpeg / webp / gif / avif |

Uploaded SVG images and raw HTML SVG are not supported. Static Mermaid diagrams
use separately sanitized, generated SVG.

## 📚 Documentation

- [Markdown compatibility](docs/markdown.md)
- [CLI reference](docs/cli.md)
- [Authentication and migration](docs/authentication.md)
- [MCP guide](docs/mcp.md)
- [Skill](docs/skill.md)
- [Self-hosting](docs/self-hosting.md)
- [Deployment operations](docs/deployment.md)
- [Architecture](docs/architecture.md)
- [Publish protocol](docs/protocol.md)
- [Security model](docs/security.md)
- [Security policy](SECURITY.md)

> Production Workers deploy from `main` through Cloudflare Workers Builds. GitHub Actions handles CI and stable-tag CLI/GitHub releases; see [deployment operations](docs/deployment.md).

## 📄 License

Mote is released under the [MIT License](LICENSE).
