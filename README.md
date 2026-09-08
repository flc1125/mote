<p align="center">
  <picture>
    <source media="(prefers-color-scheme: dark)" srcset="docs/assets/logo-dark.png">
    <img src="docs/assets/logo.png" alt="Mote" width="240">
  </picture>
</p>

<h1 align="center">Mote</h1>

<p align="center">
  <strong>Markdown in, URL out.</strong><br>
  Publish local Markdown documents as immutable, unguessable, browser-readable web pages.
</p>

<p align="center">
  <a href="https://github.com/flc1125/mote/actions/workflows/ci.yml"><img src="https://github.com/flc1125/mote/actions/workflows/ci.yml/badge.svg" alt="CI"></a>
  <a href="https://www.npmjs.com/package/mote-cli"><img src="https://img.shields.io/npm/v/mote-cli" alt="npm"></a>
  <a href="https://www.npmjs.com/package/mote-cli"><img src="https://img.shields.io/npm/dm/mote-cli" alt="npm downloads"></a>
  <a href="LICENSE"><img src="https://img.shields.io/badge/License-MIT-blue.svg" alt="License: MIT"></a>
  <a href="https://nodejs.org"><img src="https://img.shields.io/badge/node-%E2%89%A5%2020-brightgreen" alt="Node ≥ 20"></a>
</p>

<p align="center">
  <a href="#-quick-start">Quick Start</a> •
  <a href="https://mote.flc.io/1tAPUJjNt67GQ2pS">Live Demo</a> •
  <a href="docs/self-hosting.md">Self-hosting</a> •
  <a href="README.zh-CN.md">简体中文</a>
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
  <sub>The output above is illustrative — see a real <a href="https://mote.flc.io/1tAPUJjNt67GQ2pS">public sample with an image</a>.</sub>
</p>

## ✨ Features

|                        |                                                                                                          |
| ---------------------- | -------------------------------------------------------------------------------------------------------- |
| 🔒 **Immutable**       | Every publish creates a new URL; old URLs keep their content forever                                     |
| 🔑 **Capability URL**  | The URL is the only credential — unguessable (94-bit random ID), never indexed                           |
| 🖼️ **Local images**    | Referenced images are uploaded automatically, deduplicated, and served from opaque URLs                  |
| ⚡ **Fast**            | Cloudflare Workers + R2 + CDN cache; no database, no JS on pages                                          |
| 🤖 **Agent-ready**     | CLI `--json` output, plus remote and local MCP servers                                                    |

## 🚀 Quick Start

```bash
npm install -g mote-cli
```

> **Note** — Browser login and Service Token authentication require **mote-cli ≥ 0.2.0**. Older npm versions do not include these commands.

<details><summary><strong>From source</strong> (requires Node.js ≥ 20 and pnpm)</summary>

```bash
git clone https://github.com/flc1125/mote.git
cd mote
pnpm install
pnpm --filter @mote/cli build
cd apps/cli && npm install -g .
```

</details>

### Access-enabled instance

```bash
mote login
mote README.md
```

The default instance, `https://mote.flc.io`, permits only approved publishers. For your own Access-enabled instance, use `mote login --api https://mote.example.com --auth-mode oauth`. Successful login remembers the instance; explicit environment/config overrides still apply. See the [authentication guide](docs/authentication.md) for setup and migration limits.

### Static-token instance

Configure your own token-mode instance and its token (see [Self-hosting](docs/self-hosting.md)); replace the example host with yours. A static token cannot publish to production `mote.flc.io`:

```bash
export MOTE_API_URL="https://mote.example.com"
export MOTE_TOKEN="your-token"
export MOTE_AUTH_MODE="token"
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
https://mote.example.com/7Vk3mQ9x2NFaP4Ls
```

## 📖 Usage

|                |                                                                                                                            |
| -------------- | -------------------------------------------------------------------------------------------------------------------------- |
| **CLI**        | Options (`--json`, `--no-assets`, `--api`, `--token`, …), config file, and scripting → [docs/cli.md](docs/cli.md)          |
| **MCP**        | Remote OAuth and local stdio tools; setup and compatibility → [docs/mcp.md](docs/mcp.md)                                   |
| **Skill**      | Teach agents when/how to use Mote (`npx skills add flc1125/mote`) → [docs/skill.md](docs/skill.md)                         |
| **Self-hosting** | Run your own instance on Cloudflare's free tier → [docs/self-hosting.md](docs/self-hosting.md)                           |

## 📏 Limits

| Item          | Limit                          |
| ------------- | ------------------------------ |
| Markdown      | ≤ 2 MB                         |
| Single image  | ≤ 10 MB                        |
| Whole bundle  | ≤ 20 MB                        |
| Images        | ≤ 50                           |
| Image formats | png / jpeg / webp / gif / avif |

SVG is not supported (active-content risk). Documents are immutable — republishing edited content creates a new URL.

## 📚 Documentation

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

---

<p align="center">
  Released under the <a href="LICENSE">MIT License</a>.<br>
  <sub>Copyright © flc1125</sub>
</p>
