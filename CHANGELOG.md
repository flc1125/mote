# Changelog

All notable changes to Mote are documented here.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and this project adheres to [Semantic Versioning](https://semver.org/): minor for new features, patch for fixes.

## [Unreleased]

## [0.7.0] - 2026-09-16

### Added

- Document-local abbreviations with `*[term]: explanation`, case-sensitive Unicode word boundaries and bounded static hints. Existing valid declarations now define abbreviations; escape the opening asterisk to keep a literal declaration. ([#67](https://github.com/flc1125/mote/pull/67))
- Footnote previews with keyboard/touch activation, focus restoration, scrollable static content and links to full notes. Unsupported browsers, complex notes and budget overruns retain native anchors; the fixed preview script shares its exact CSP hash across GET and HEAD. ([#67](https://github.com/flc1125/mote/pull/67))
- Text highlights with `==text==` and definition lists with shared CLI/Viewer parsing, static reading styles and rich definition bodies. Existing unescaped matching syntax now renders as these structures; use escapes or code to preserve literal examples. ([#65](https://github.com/flc1125/mote/pull/65))
- Image widths with a bounded `{ width="640" }` / percentage subset, image-only `/// caption` blocks, and a progressive native-dialog image viewer. Shared parsing preserves asset paths and deduplication; linked/inline images keep their behavior. Later Markdown images use native lazy loading, with a fixed image-script CSP hash shared by GET and HEAD. ([#64](https://github.com/flc1125/mote/pull/64))
- Content tabs with `=== "label"`: independent groups, keyboard navigation, panel and heading deep links, shared CLI/Viewer parsing and bounded nesting. All panels remain readable without JavaScript and in print; initialization failures retain static content. ([#63](https://github.com/flc1125/mote/pull/63))
- Extended admonitions with `!!!`, `???` and `???+`: seven types, plain-text custom titles, bounded nesting and native disclosures. They share a tinted title band and page-colored body with GitHub alerts and native HTML disclosures. CLI and Viewer use the same structure rules for nested images; links reveal closed ancestors, and printing includes folded bodies. ([#62](https://github.com/flc1125/mote/pull/62))
- Fenced-code copy controls, plain-text titles, optional line numbers and highlighted line ranges. Bounded enhancements preserve parser-normalized code text and fall back to ordinary code on budget overruns. Titles and line emphasis work without JavaScript; the fixed copy script is authorized by its exact CSP hash, with matching GET/HEAD policies. ([#60](https://github.com/flc1125/mote/pull/60))
- Bilingual documentation navigation and usage guides, publishable Markdown specimens, automated documentation checks and a reusable release checklist. ([#56](https://github.com/flc1125/mote/pull/56), [#57](https://github.com/flc1125/mote/pull/57), [#58](https://github.com/flc1125/mote/pull/58), [#59](https://github.com/flc1125/mote/pull/59), [#68](https://github.com/flc1125/mote/pull/68))

### Changed

- **Breaking:** `mote login` and `mote auth login` select the API origin from `--api` or the built-in default `https://mote.pub`, independently of remembered instances, `MOTE_API_URL` and config `apiUrl`. Other commands retain their existing selection priority. ([#54](https://github.com/flc1125/mote/pull/54))

### Fixed

- Discover local images in multi-paragraph footnotes using the same Markdown structure rules as the Viewer, while keeping code and mathematical source out of asset uploads. ([#61](https://github.com/flc1125/mote/pull/61))
- Reject protocol-relative image URLs, including backslash variants, in Markdown and allowlisted HTML. Use explicit `https://` or `http://` URLs for remote images. ([#55](https://github.com/flc1125/mote/pull/55))
- Return `413 BUNDLE_TOO_LARGE` instead of `422 INVALID_DOCUMENT` when a publish manifest exceeds 50 assets, rejecting the count before processing image bytes. ([#55](https://github.com/flc1125/mote/pull/55))
- Report the stored Markdown's UTF-8 byte size in Viewer render logs, including documents containing Chinese text or emoji. ([#55](https://github.com/flc1125/mote/pull/55))
- Tighten spacing before return links in footnotes that contain definition lists. ([#66](https://github.com/flc1125/mote/pull/66))

### Upgrade notes

- Upgrade to `mote-cli@0.7.0`, or rebuild and restart the local stdio MCP server from the matching source revision, when publishing documents that use the new Markdown syntax. Shared parsing covers admonitions, tabs, image widths and captions, highlights, definition lists and abbreviations, as well as multi-paragraph footnotes. Older clients can disagree with the updated Viewer about which text is code, an image reference or a plain-text abbreviation explanation; images in nested content may be omitted or literal image examples misidentified. ([#61](https://github.com/flc1125/mote/pull/61), [#68](https://github.com/flc1125/mote/pull/68))
- Updating the Viewer cannot upload assets omitted by an older client. To include missing assets, publish the original Markdown again with the updated client; this creates a new document URL. Existing document IDs, stored Markdown and uploaded assets stay unchanged. Viewer upgrades can change how existing unescaped extension syntax is displayed; use escapes or code in source examples that should remain literal. See the [Markdown reference](https://github.com/flc1125/mote/blob/v0.7.0/docs/markdown.md) for syntax and fallback boundaries. ([#68](https://github.com/flc1125/mote/pull/68))
- Stable tags release the CLI and GitHub Release only; API and Viewer deploy independently through Workers Builds on `main`. Check the deployed Worker revisions separately from the installed CLI version. See the [deployment and release checklist](https://github.com/flc1125/mote/blob/v0.7.0/docs/deployment.md#markdown-release-checklist). ([#68](https://github.com/flc1125/mote/pull/68))
- Self-hosted users must pass `--api <your-instance-origin>` when logging in instead of relying on saved publishing settings. Explicit auth-mode settings still apply. Successful login remembers the selected instance; explicit environment/config API overrides still control subsequent publishing and are reported after login. ([#54](https://github.com/flc1125/mote/pull/54))

## [0.6.0] - 2026-09-11

### Added

- Expanded Markdown rendering with GitHub-style alerts, selected-language code highlighting, conservative YAML front matter recognition, CJK emphasis handling, native MathML formulas and six families of sanitized, server-rendered Mermaid diagrams. Unsupported syntax and rendering-budget overruns retain readable source. ([#42](https://github.com/flc1125/mote/pull/42))
- Responsive document contents navigation with section tracking, collapsible branches, desktop positioning, a mobile drawer and keyboard/focus handling. Only the fixed contents script is authorized by its exact CSP hash; document content cannot execute scripts. Static contents links remain usable without JavaScript. ([#47](https://github.com/flc1125/mote/pull/47))
- Interactive CLI login actions: press `o` to open the authorization link, `c` to copy it, or `Ctrl+C` to cancel. Added clearer authentication status, logout and error output. ([#45](https://github.com/flc1125/mote/pull/45))
- Default publishing progress and a document/image summary on terminal stderr. Redirected stderr stays quiet unless `--verbose` is set; `--json` suppresses progress and retains the exact publish result `{id,url}` on stdout. ([#46](https://github.com/flc1125/mote/pull/46))

### Changed

- Widened the document reading area to 760px and opened document header/footer brand links in a new tab so readers keep their current document. ([#48](https://github.com/flc1125/mote/pull/48), [#51](https://github.com/flc1125/mote/pull/51))
- Added publishable compatibility and fallback specimens, linked the READMEs to the live example, and refined the publishing Skill guidance and branding. ([#42](https://github.com/flc1125/mote/pull/42), [#43](https://github.com/flc1125/mote/pull/43), [#44](https://github.com/flc1125/mote/pull/44))

### Fixed

- Resolve encoded local image paths consistently across publishing and rendering, including Unicode and spaces. Image scanning ignores recognized front matter and mathematical source while stored Markdown remains unchanged. ([#42](https://github.com/flc1125/mote/pull/42))
- Allocate unique heading IDs for repeated, numeric-suffixed and punctuation-only headings, avoid collisions with generated UI IDs, and preserve task-list inline formatting exactly once. ([#42](https://github.com/flc1125/mote/pull/42))

### Upgrade notes

- Upgrade to `mote-cli@0.6.0` for the CLI interaction and image-scanning changes. Local stdio MCP users should rebuild from the matching source revision and restart their server; the MCP workspace package remains private.
- **CLI behavior change:** login now shows the authorization URL and waits for an explicit `o` action instead of opening a browser automatically. `--no-browser` provides manual link mode without keyboard actions. Scripts consuming authentication status or logout output should use `--json`; their default output is now human-readable. ([#45](https://github.com/flc1125/mote/pull/45))
- Existing document IDs and stored Markdown remain unchanged. Updated Viewer rendering can hide recognized front matter and change previously ambiguous heading anchors; ordinary heading links are preserved. See the [Markdown compatibility guide](https://github.com/flc1125/mote/blob/v0.6.0/docs/markdown.md) for limits. ([#42](https://github.com/flc1125/mote/pull/42))
- Stable tags publish the CLI package and GitHub Release only. API and Viewer deploy independently through Workers Builds on `main`; verify both production rollouts separately. Installing the CLI does not deploy the new rendering or contents navigation.

### Contributors

- [@flc1125](https://github.com/flc1125) — Markdown rendering, document navigation, CLI improvements, documentation and release preparation.

## [0.5.0] - 2026-09-09

### Changed

- Refined all four CLI login callback pages with clearer status messages, typography, and layout, and added navigation to the Mote homepage. ([#33](https://github.com/flc1125/mote/pull/33))
- **Breaking:** moved the default production instance from `https://mote.flc.io` to `https://mote.pub`, including CLI defaults, callback homepage links, website examples, and remote MCP setup. Production Worker routes and Access hostname configuration use the new domain; the isolated test environment keeps its existing configuration. ([#34](https://github.com/flc1125/mote/pull/34))

### Upgrade notes

- Upgrade to `mote-cli@0.5.0`. Existing users of the default instance must run `mote login --api https://mote.pub --auth-mode oauth` and update any old `MOTE_API_URL` or explicit API configuration. Upgrading the CLI does not overwrite saved instance preferences or configuration; credentials are scoped to the API origin. ([#34](https://github.com/flc1125/mote/pull/34))
- Set remote MCP clients to `https://mote.pub/api/mcp` and authorize them again. Local stdio MCP users should rebuild from this release, update any explicit API URL, and restart the server; the MCP workspace package remains private. ([#34](https://github.com/flc1125/mote/pull/34))
- Existing documents remain available under the same IDs on the new domain. Old-domain redirects are temporary convenience for shared links, not a dependency for clients: CLI authentication and publishing do not follow redirects. Self-hosted instances retain their explicitly configured addresses. See the [authentication guide](https://github.com/flc1125/mote/blob/v0.5.0/docs/authentication.md) for migration details. ([#34](https://github.com/flc1125/mote/pull/34))
- Stable tags publish the CLI package and GitHub Release only. Production API and Viewer deployments remain independent through Workers Builds on `main`. ([#34](https://github.com/flc1125/mote/pull/34))

## [0.4.0] - 2026-09-08

### Added

- Footnotes and read-only task lists in published Markdown documents. ([#26](https://github.com/flc1125/mote/pull/26))
- Allowlisted HTML rendering for README-style content, including centered paragraphs, `picture` images, `details` / `summary`, and inline formatting. User HTML passes through a streaming sanitizer that strips unsafe tags and attributes and validates image and link URLs. ([#26](https://github.com/flc1125/mote/pull/26))
- Local image discovery in HTML `img src`, `img srcset`, and `source srcset`, so the CLI and local MCP publishing pipeline upload images referenced by README HTML. ([#26](https://github.com/flc1125/mote/pull/26))
- Copy buttons for the homepage's CLI, MCP, and Skill command blocks, plus a readable weekly-report showcase with its Markdown source. ([#29](https://github.com/flc1125/mote/pull/29), [#30](https://github.com/flc1125/mote/pull/30))

### Changed

- Redesigned the homepage with a dark hero, terminal demo, and clearer publishing setup guidance. Its copy script is authorized by an exact CSP hash; published document pages remain script-free. ([#24](https://github.com/flc1125/mote/pull/24), [#30](https://github.com/flc1125/mote/pull/30))
- Refined document typography, spacing, code blocks, and red accents; moved the table of contents into a drawer and made wide Markdown tables keyboard-scrollable without widening the page. ([#27](https://github.com/flc1125/mote/pull/27), [#28](https://github.com/flc1125/mote/pull/28))
- Reorganized the English and Chinese READMEs around CLI, MCP, and Skill setup, and added vertical spacing around their logos. ([#23](https://github.com/flc1125/mote/pull/23), [#32](https://github.com/flc1125/mote/pull/32))

### Fixed

- Manual selection of homepage commands now excludes decorative `$` prompts and leading spaces while preserving multiline commands and line breaks. ([#31](https://github.com/flc1125/mote/pull/31))

### Upgrade notes

- Upgrade to `mote-cli@0.4.0` to upload local images referenced by HTML. Local MCP users should rebuild from the matching source revision; the MCP workspace package remains private. ([#26](https://github.com/flc1125/mote/pull/26), [#32](https://github.com/flc1125/mote/pull/32))
- Rendering improvements require the updated Viewer Worker. Existing Markdown containing allowed HTML now renders that markup instead of showing escaped tags; scripts and unsafe attributes remain blocked. ([#26](https://github.com/flc1125/mote/pull/26))
- Stable tags publish the CLI package and GitHub Release only. API and Viewer deployments continue independently through Workers Builds on `main`; verify both production rollouts separately. ([#15](https://github.com/flc1125/mote/pull/15), [#16](https://github.com/flc1125/mote/pull/16), [#17](https://github.com/flc1125/mote/pull/17))

## [0.3.0] - 2026-09-08

### Added

- Shared `@mote/theme` design package: light/dark token palettes derived from the brand red, baseline element styles, and the embedded icon mark (kept in sync by `scripts/brand/sync.mjs`). ([#21](https://github.com/flc1125/mote/pull/21))

### Changed

- Redesigned the homepage: hero with a terminal demo linking to the live public sample, then the CLI/MCP/Skill quick start as the central tinted band with terminal-styled command blocks, followed by how-it-works steps and six feature cards. Still fully static and JavaScript-free. ([#21](https://github.com/flc1125/mote/pull/21))
- Restyled published document pages on the shared design system: a slim brand banner and colophon, red accent links replacing the GitHub blue, a collapsible tinted Contents block replacing the always-expanded TOC, and bordered code blocks. Existing document URLs pick up the new look automatically through per-Worker-version cache keys; no purge needed. ([#21](https://github.com/flc1125/mote/pull/21))
- The `mote login` loopback callback now serves branded static HTML pages (success / denied / invalid / missing code) instead of plain text. The pages never echo callback parameters; the callback CSP gains `style-src 'unsafe-inline'` and nothing else. ([#21](https://github.com/flc1125/mote/pull/21))
- ESLint now ignores the gitignored `.docs/` scratch directory, so `pnpm lint` works with local recovery data present. ([#21](https://github.com/flc1125/mote/pull/21))

## [0.2.0] - 2026-09-07

### Added

- `cloudflare-access` server authentication with signed assertion validation for user OAuth and Service Token identities; omitted mode settings retain the legacy token fallback, while checked-in production configuration explicitly selects Access. ([#6](https://github.com/flc1125/mote/pull/6))
- `mote auth login/status/logout`, target-bound system/private-file credentials, PKCE login, serialized refresh and explicit machine mode. ([#6](https://github.com/flc1125/mote/pull/6))
- `mote login` as a shortcut for `mote auth login`; successful login remembers the API origin after credentials are saved. API selection is flags → environment → config → remembered instance → built-in default; explicit auth-mode settings are unchanged. ([#19](https://github.com/flc1125/mote/pull/19))
- Local stdio sharing the Mote CLI credential store and publishing pipeline, with authentication before local file reads. ([#6](https://github.com/flc1125/mote/pull/6))
- A static, JavaScript-free homepage with keyboard-accessible CLI/MCP/Skill quick-start switching and documentation links; static routes do not read R2 or list published documents. ([#19](https://github.com/flc1125/mote/pull/19))
- Coral branding (`#ef5552`), vector logos and icons, theme-aware homepage wordmarks, and same-origin SVG/ICO favicons for the homepage and published documents. The all-coral logo remains available. ([#19](https://github.com/flc1125/mote/pull/19))
- Production Worker deployment through Cloudflare Workers Builds on pushes to `main`, with independent API/Viewer rollouts. GitHub Actions retains CI, credential-free Worker dry-runs, npm Trusted Publishing and GitHub Release; stable tags no longer deploy Workers. ([#15](https://github.com/flc1125/mote/pull/15), [#16](https://github.com/flc1125/mote/pull/16), [#17](https://github.com/flc1125/mote/pull/17))
- Authentication/migration guidance and verified macOS CLI/stdio + Codex 0.153.4 app-server scope. Other clients/platforms and full 7-day/30-day natural expiry are not claimed as tested. ([#6](https://github.com/flc1125/mote/pull/6))

### Fixed

- Regenerate PKCE verifier/challenge pairs locally when the challenge starts with `-` or `_`, as required by Cloudflare Access. ([#6](https://github.com/flc1125/mote/pull/6))
- Make token-mode self-hosting and quick-start targets explicit, and replace the private architecture baseline dependency with public documentation references. ([#6](https://github.com/flc1125/mote/pull/6))

### Upgrade notes

- Upgrade to `mote-cli@0.2.0` for OAuth/service authentication and `mote login`. Existing static-token self-hosted instances remain supported; production `mote.flc.io` requires an approved Access identity. Installing the CLI does not migrate server authentication. ([#6](https://github.com/flc1125/mote/pull/6), [#19](https://github.com/flc1125/mote/pull/19), [#20](https://github.com/flc1125/mote/pull/20))
- `mote auth login` remains supported. Login preserves explicit configuration; environment/config overrides can still select a different instance or auth mode. Logout removes local OAuth credentials but retains the remembered instance and OAuth selection marker, preventing implicit fallback to an old token. ([#6](https://github.com/flc1125/mote/pull/6), [#19](https://github.com/flc1125/mote/pull/19), [#20](https://github.com/flc1125/mote/pull/20))
- Local MCP remains a private workspace package built from the matching source revision; it is not published as a separate npm package. Remote MCP remains a deployed endpoint, and the Skill remains repository-distributed instructions. ([#20](https://github.com/flc1125/mote/pull/20))
- Stable tags now publish only the CLI package and GitHub Release, not Workers. Workers Builds deploys API and Viewer independently from `main`; verify both production rollouts separately before accepting the release. ([#15](https://github.com/flc1125/mote/pull/15), [#16](https://github.com/flc1125/mote/pull/16), [#17](https://github.com/flc1125/mote/pull/17), [#20](https://github.com/flc1125/mote/pull/20))
- No broader compatibility or full 7-day/30-day expiry validation is claimed. See [deployment operations](docs/deployment.md), [self-hosting](docs/self-hosting.md#deployment-automation) and [authentication](docs/authentication.md) for setup, migration and validation limits. ([#6](https://github.com/flc1125/mote/pull/6), [#14](https://github.com/flc1125/mote/pull/14), [#17](https://github.com/flc1125/mote/pull/17), [#20](https://github.com/flc1125/mote/pull/20))

## [0.1.1] - 2026-09-04

### Fixed

- Package metadata: publish as `mote-cli` via a `publishConfig` override, keeping the workspace name `@mote/cli` intact (no dangling workspace references) ([#2](https://github.com/flc1125/mote/pull/2))
- Ship `dist/index.js` and type declarations so the published `main`/`types`/`exports` entry points actually resolve ([#2](https://github.com/flc1125/mote/pull/2))

## [0.1.0] - 2026-09-04

First open-source release.

Published manually to npm without a matching Git tag or GitHub Release; v0.1.1 is the first automated GitHub Release.

### Added

- **`mote` CLI** — publish Markdown in one command; AST-based local image scanning, content-hash dedupe, `--json` output for agents/CI ([initial commit](https://github.com/flc1125/mote/commit/214ded08ef6f19483e8cba460ba268e756fe49d5); no PR)
- **Immutable documents** — every publish creates a new unguessable URL (16-char Base58, ~94-bit entropy); old URLs keep their content forever ([initial commit](https://github.com/flc1125/mote/commit/214ded08ef6f19483e8cba460ba268e756fe49d5); no PR)
- **Viewer** — runtime markdown-it rendering (raw HTML disabled), GitHub-style typography, dark mode, TOC + heading anchors, strict CSP, no JS, noindex ([initial commit](https://github.com/flc1125/mote/commit/214ded08ef6f19483e8cba460ba268e756fe49d5); no PR)
- **Publish API** — `POST /api/v1/publish` with Bearer auth, multipart bundles, magic-bytes image validation, manifest-last atomic commits to R2 ([initial commit](https://github.com/flc1125/mote/commit/214ded08ef6f19483e8cba460ba268e756fe49d5); no PR)
- **Remote MCP** — stateless Streamable HTTP endpoint `POST /api/mcp` with the `publish_markdown` tool (Claude.ai, Codex, any MCP client) ([initial commit](https://github.com/flc1125/mote/commit/214ded08ef6f19483e8cba460ba268e756fe49d5); no PR)
- **Local MCP** — stdio `mote-mcp` server with `publish_markdown` + `publish_markdown_file` (local image upload via the CLI's scanning chain) ([initial commit](https://github.com/flc1125/mote/commit/214ded08ef6f19483e8cba460ba268e756fe49d5); no PR)
- **Agent skill** — `skills/mote/SKILL.md`, installable via `npx skills add flc1125/mote` ([initial commit](https://github.com/flc1125/mote/commit/214ded08ef6f19483e8cba460ba268e756fe49d5); no PR)
- **Docs** — architecture, publish protocol, security model, self-hosting guide, CLI and MCP references (English + 中文) ([initial commit](https://github.com/flc1125/mote/commit/214ded08ef6f19483e8cba460ba268e756fe49d5); no PR)
- **Infrastructure** — Cloudflare Workers + R2 only; Workers Cache with per-version cache namespaces; runs on the free tier ([initial commit](https://github.com/flc1125/mote/commit/214ded08ef6f19483e8cba460ba268e756fe49d5); no PR)

[Unreleased]: https://github.com/flc1125/mote/compare/v0.7.0...HEAD
[0.7.0]: https://github.com/flc1125/mote/releases/tag/v0.7.0
[0.6.0]: https://github.com/flc1125/mote/releases/tag/v0.6.0
[0.5.0]: https://github.com/flc1125/mote/releases/tag/v0.5.0
[0.4.0]: https://github.com/flc1125/mote/releases/tag/v0.4.0
[0.3.0]: https://github.com/flc1125/mote/releases/tag/v0.3.0
[0.2.0]: https://github.com/flc1125/mote/releases/tag/v0.2.0
[0.1.1]: https://github.com/flc1125/mote/releases/tag/v0.1.1
[0.1.0]: https://www.npmjs.com/package/mote-cli/v/0.1.0
