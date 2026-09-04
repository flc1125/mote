<p align="center">
  <picture>
    <source media="(prefers-color-scheme: dark)" srcset="docs/assets/logo-dark.png">
    <img src="docs/assets/logo.png" alt="Mote" width="240">
  </picture>
</p>

[简体中文](README.zh-CN.md)

# Mote

[![CI](https://github.com/flc1125/mote/actions/workflows/ci.yml/badge.svg)](https://github.com/flc1125/mote/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![npm](https://img.shields.io/npm/v/mote-cli)](https://www.npmjs.com/package/mote-cli)

> **Mote = Markdown in, URL out.**
>
> Publish local Markdown documents as immutable, unguessable, browser-readable web pages.

```bash
mote README.md
```

```text
Published:

https://mote.flc.io/7Vk3mQ9x2NFaP4Ls
```

## Features

- **Immutable** — every publish creates a new URL; old URLs keep their content forever
- **Capability URL** — the URL is the only credential; unguessable (94-bit random ID), never indexed
- **Local images** — referenced images are uploaded automatically, deduplicated, and served from opaque URLs
- **Fast** — Cloudflare Workers + R2 + CDN cache; no database, no JS on pages
- **Agent-ready** — CLI `--json` output, plus remote and local MCP servers

## Quick Start

```bash
npm install -g mote-cli
```

<details><summary>From source (requires Node.js ≥ 20 and pnpm)</summary>

```bash
git clone https://github.com/flc1125/mote.git
cd mote
pnpm install
pnpm --filter @mote/cli build
cd apps/cli && npm install -g .
```

</details>

Configure a token from your Mote instance (see [Self-hosting](docs/self-hosting.md)):

```bash
export MOTE_TOKEN="your-token"
```

Publish:

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

## Usage

- **CLI** — options (`--json`, `--no-assets`, `--api`, `--token`, …), config file, and scripting: [docs/cli.md](docs/cli.md)
- **MCP** — remote endpoint for Claude.ai / Codex / any MCP client, plus a local stdio server: [docs/mcp.md](docs/mcp.md)
- **Skill** — teach agents when/how to use Mote (`npx skills add flc1125/mote`): [docs/skill.md](docs/skill.md)
- **Self-hosting** — run your own instance on Cloudflare's free tier: [docs/self-hosting.md](docs/self-hosting.md)

## Limits

| Item          | Limit                          |
| ------------- | ------------------------------ |
| Markdown      | ≤ 2 MB                         |
| Single image  | ≤ 10 MB                        |
| Whole bundle  | ≤ 20 MB                        |
| Images        | ≤ 50                           |
| Image formats | png / jpeg / webp / gif / avif |

SVG is not supported (active-content risk). Documents are immutable — republishing edited content creates a new URL.

## Documentation

- [CLI reference](docs/cli.md)
- [MCP guide](docs/mcp.md)
- [Skill](docs/skill.md)
- [Self-hosting](docs/self-hosting.md)
- [Architecture](docs/architecture.md)
- [Publish protocol](docs/protocol.md)
- [Security model](docs/security.md)
- [Security policy](SECURITY.md)

## License

[MIT](LICENSE)
