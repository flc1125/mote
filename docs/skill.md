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

## What it does

Once installed, an agent that is asked to "share this Markdown" / "publish this doc" / "make this readable in a browser" will:

1. Choose a publish path — MCP tools (`publish_markdown` / `publish_markdown_file`) if the Mote MCP server is connected, otherwise the CLI (`mote <file> --json`)
2. Publish and parse the result
3. Return the URL verbatim

It also encodes the guardrails: never publish credentials/secrets (Mote URLs are capabilities and documents are immutable), respect size limits, and report errors honestly.

## Requirements

The skill itself is just instructions — publishing still needs:

- The CLI installed and a token configured (see [CLI reference](cli.md)), or
- A Mote MCP server connected (see [MCP guide](mcp.md))
