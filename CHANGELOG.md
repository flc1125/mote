# Changelog

All notable changes to Mote are documented here.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and this project adheres to [Semantic Versioning](https://semver.org/): minor for new features, patch for fixes.

## [Unreleased]

### Added

- Shared `@mote/theme` design package: light/dark token palettes derived from the brand red, baseline element styles, and the embedded icon mark (kept in sync by `scripts/brand/sync.mjs`).

### Changed

- Redesigned the homepage: hero with a terminal demo linking to the live public sample, then the CLI/MCP/Skill quick start as the central tinted band with terminal-styled command blocks, followed by how-it-works steps and six feature cards. Still fully static and JavaScript-free.
- Restyled published document pages on the shared design system: a slim brand banner and colophon, red accent links replacing the GitHub blue, a collapsible tinted Contents block replacing the always-expanded TOC, and bordered code blocks. Existing document URLs pick up the new look automatically through per-Worker-version cache keys; no purge needed.
- The `mote login` loopback callback now serves branded static HTML pages (success / denied / invalid / missing code) instead of plain text. The pages never echo callback parameters; the callback CSP gains `style-src 'unsafe-inline'` and nothing else.
- ESLint now ignores the gitignored `.docs/` scratch directory, so `pnpm lint` works with local recovery data present.

## [0.2.0] - 2026-09-07

### Added

- `cloudflare-access` server authentication with signed assertion validation for user OAuth and Service Token identities; omitted mode settings retain the legacy token fallback, while checked-in production configuration explicitly selects Access.
- `mote auth login/status/logout`, target-bound system/private-file credentials, PKCE login, serialized refresh and explicit machine mode.
- `mote login` as a shortcut for `mote auth login`; successful login remembers the API origin after credentials are saved. API selection is flags → environment → config → remembered instance → built-in default; explicit auth-mode settings are unchanged.
- Local stdio sharing the Mote CLI credential store and publishing pipeline, with authentication before local file reads.
- A static, JavaScript-free homepage with keyboard-accessible CLI/MCP/Skill quick-start switching and documentation links; static routes do not read R2 or list published documents.
- Coral branding (`#ef5552`), vector logos and icons, theme-aware homepage wordmarks, and same-origin SVG/ICO favicons for the homepage and published documents. The all-coral logo remains available.
- Production Worker deployment through Cloudflare Workers Builds on pushes to `main`, with independent API/Viewer rollouts. GitHub Actions retains CI, credential-free Worker dry-runs, npm Trusted Publishing and GitHub Release; stable tags no longer deploy Workers.
- Authentication/migration guidance and verified macOS CLI/stdio + Codex 0.153.4 app-server scope. Other clients/platforms and full 7-day/30-day natural expiry are not claimed as tested.

### Fixed

- Regenerate PKCE verifier/challenge pairs locally when the challenge starts with `-` or `_`, as required by Cloudflare Access.
- Make token-mode self-hosting and quick-start targets explicit, and replace the private architecture baseline dependency with public documentation references.

### Upgrade notes

- Upgrade to `mote-cli@0.2.0` for OAuth/service authentication and `mote login`. Existing static-token self-hosted instances remain supported; production `mote.flc.io` requires an approved Access identity. Installing the CLI does not migrate server authentication.
- `mote auth login` remains supported. Login preserves explicit configuration; environment/config overrides can still select a different instance or auth mode. Logout removes local OAuth credentials but retains the remembered instance and OAuth selection marker, preventing implicit fallback to an old token.
- Local MCP remains a private workspace package built from the matching source revision; it is not published as a separate npm package. Remote MCP remains a deployed endpoint, and the Skill remains repository-distributed instructions.
- Stable tags now publish only the CLI package and GitHub Release, not Workers. Workers Builds deploys API and Viewer independently from `main`; verify both production rollouts separately before accepting the release.
- No broader compatibility or full 7-day/30-day expiry validation is claimed. See [deployment operations](docs/deployment.md), [self-hosting](docs/self-hosting.md#deployment-automation) and [authentication](docs/authentication.md) for setup, migration and validation limits.

## [0.1.1] - 2026-09-04

### Fixed

- Package metadata: publish as `mote-cli` via a `publishConfig` override, keeping the workspace name `@mote/cli` intact (no dangling workspace references)
- Ship `dist/index.js` and type declarations so the published `main`/`types`/`exports` entry points actually resolve

## [0.1.0] - 2026-09-04

First open-source release.

Published manually to npm without a matching Git tag or GitHub Release; v0.1.1 is the first automated GitHub Release.

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

[Unreleased]: https://github.com/flc1125/mote/compare/v0.2.0...HEAD
[0.2.0]: https://github.com/flc1125/mote/releases/tag/v0.2.0
[0.1.1]: https://github.com/flc1125/mote/releases/tag/v0.1.1
[0.1.0]: https://www.npmjs.com/package/mote-cli/v/0.1.0
