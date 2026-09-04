# Changelog

All notable changes to Mote are documented here.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and this project adheres to [Semantic Versioning](https://semver.org/): minor for new features, patch for fixes.

## [0.1.1] - 2026-09-04

### Fixed

- Package metadata: publish as `mote-cli` via a `publishConfig` override, keeping the workspace name `@mote/cli` intact (no dangling workspace references)
- Ship `dist/index.js` and type declarations so the published `main`/`types`/`exports` entry points actually resolve

## [0.1.0] - 2026-09-04

First open-source release.

### Added

- **`mote` CLI** — publish Markdown in one command; AST-based local image scanning, content-hash dedupe, `--json` output for agents/CI
- **Immutable documents** — every publish creates a new unguessable URL (16-char Base58, ~94-bit entropy); old URLs keep their content forever
- **Viewer** — runtime markdown-it rendering (raw HTML disabled), GitHub-style typography, dark mode, TOC + heading anchors, strict CSP, no JS, noindex
- **Publish API** — `POST /api/v1/publish` with Bearer auth, multipart bundles, magic-bytes image validation, manifest-last atomic commits to R2
- **Remote MCP** — stateless Streamable HTTP endpoint `POST /api/mcp` with the `publish_markdown` tool (Claude.ai, Codex, any MCP client)
- **Local MCP** — stdio `mote-mcp` server with `publish_markdown` + `publish_markdown_file` (local image upload via the CLI's scanning chain)
- **Agent skill** — `skills/mote/SKILL.md`, installable via `npx skills add flc1125/mote`
- **Docs** — architecture, publish protocol, security model, self-hosting guide, CLI and MCP references (English + 中文)
- **Infrastructure** — Cloudflare Workers + R2 only; Workers Cache with per-version cache namespaces; runs on the free tier

[0.1.1]: https://github.com/flc1125/mote/compare/v0.1.0...v0.1.1
[0.1.0]: https://github.com/flc1125/mote/releases/tag/v0.1.0
