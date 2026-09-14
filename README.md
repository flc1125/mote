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

- 🔒 **Immutable** — every publish creates a new URL; stored Markdown and uploaded assets cannot be updated
- 🔑 **Capability URL** — anyone with the URL can read it; a 94-bit random ID resists guessing, and pages request no indexing
- 🖼️ **Local images** — referenced images are uploaded automatically, deduplicated, and served from opaque URLs
- ⚡ **Fast** — Cloudflare Workers + R2 + CDN cache; no database, server-rendered documents
- 🤖 **Agent-ready** — CLI `--json` output, plus remote and local MCP servers

Availability depends on the instance and storage remaining operational. Viewer updates can change presentation; remote images depend on their hosts. Search-engine directives are not access control or a guarantee against indexing.

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

Login uses `--api` when supplied, otherwise `https://mote.pub`. A successful login remembers that instance for publishing; explicit environment and configuration overrides still take precedence. See [configuration selection](docs/authentication.md#configuration-selection).

Full options (`--json`, `--no-assets`, `--api`, `--token`, …), configuration and scripting: [docs/cli.md](docs/cli.md).

<details><summary><strong>From source</strong> (recommended: Node.js 24 and the repository's pinned pnpm)</summary>

```bash
git clone https://github.com/flc1125/mote.git
cd mote
pnpm install --frozen-lockfile
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

Run your own instance on Cloudflare: [docs/self-hosting.md](docs/self-hosting.md), including free-tier limits and capacity considerations.

## 📏 Limits

| Item            | Limit                          |
| --------------- | ------------------------------ |
| Markdown        | ≤ 2 MiB                        |
| Single image    | ≤ 10 MiB                       |
| Whole bundle    | ≤ 20 MiB                       |
| Uploaded assets | ≤ 50                           |
| Image formats   | png / jpeg / webp / gif / avif |

1 MiB = 1,048,576 bytes. The CLI counts assets after content deduplication; remote images are not included. The bundle limit is Markdown plus uploaded image bytes. See [exact limits](docs/protocol.md#大小与数量限额).

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
