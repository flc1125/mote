# Mote Skill

The `mote` skill teaches AI agents **when and how** to publish Markdown with Mote — it contains no upload implementation of its own (it drives the CLI or the MCP tools).

Skills are installable via the [skills](https://github.com/vercel-labs/skills) ecosystem CLI.

## Install

```bash
npx skills add flc1125/mote
```

Useful variants:

```bash
# Preview what the repo offers
npx skills add flc1125/mote --list

# Install to specific agents
npx skills add flc1125/mote -a claude-code -a codex

# Non-interactive (CI)
npx skills add flc1125/mote --skill mote -g -a claude-code -y
```

The skill lives at [`skills/mote/SKILL.md`](../skills/mote/SKILL.md) in this repository.

It includes Codex display metadata in `agents/openai.yaml` and bundled Mote icons
in `assets/`, so the branding remains available when only the skill directory is
installed. Other clients can use `SKILL.md` without this optional UI metadata.
Brand artwork is maintained in `docs/assets`; run `node scripts/brand/sync.mjs`
after changing it. The existing brand check also verifies the skill's icon copies.

## What it does

Once installed, an agent asked to publish Markdown online or create a shareable URL will:

1. Check for local images and choose a configured publish path. `publish_markdown` accepts text and remote image URLs; local images require the CLI or local `publish_markdown_file`, with paths resolved relative to the Markdown file.
2. Publish and parse the result
3. Return the URL verbatim

It also encodes the guardrails: never publish credentials/secrets (Mote URLs are capabilities and documents are immutable), respect size limits, and report errors honestly.

Reading, editing, or previewing a local document alone does not trigger publishing.
Links to other local documents do not publish those documents automatically.
For formulas, diagrams, and other extensions, see the [compatibility reference](markdown.md)
and [live specimen](https://mote.pub/PBqEnukxpQrkamSi). Unsupported syntax can remain
readable source even when publication succeeds.

## Requirements

The skill itself is just instructions — publishing still needs:

- A current mote-cli release or matching source build, with explicit authentication configuration or a valid Mote OAuth login (see [CLI reference](cli.md) and [authentication](authentication.md)). For the public `mote.pub` instance, use v0.5.0 or later; v0.2.0 introduced OAuth but still used the old default domain. Self-hosted users should keep their intended instance configuration, or
- A Mote MCP server connected (see [MCP guide](mcp.md))

Only the local server exposes `publish_markdown_file`. Authentication failures must be surfaced to the user; the skill does not create credentials, initiate browser login without authorization, read another client's keychain, or switch to an old token. Explicit requests for login assistance can be handled within the user's authorized scope. Do not repeat a publish after a timeout or unknown outcome without resolving whether it succeeded.
