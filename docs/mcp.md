# Mote MCP Guide

Mote offers two MCP integrations with the same goal: publish Markdown → get a URL. Both share one publish pipeline with the CLI — there is no separate upload logic.

|          | Remote MCP                               | Local MCP (stdio)                           |
| -------- | ---------------------------------------- | ------------------------------------------- |
| Endpoint | `POST https://mote.flc.io/api/mcp`       | `mote-mcp` process (stdio)                  |
| Tool     | `publish_markdown`                       | `publish_markdown`, `publish_markdown_file` |
| Auth     | `Authorization: Bearer <token>` header   | Local `MOTE_TOKEN` / config file            |
| Best for | Claude.ai, ChatGPT, Codex, shared setups | Claude Code, local agents                   |

## Remote MCP

A **stateless** Streamable HTTP endpoint (no sessions, no SSE): `initialize`, `tools/list`, `tools/call` over POST; `GET` returns 405.

### Tool: `publish_markdown`

| Parameter  | Type   | Required | Description                                   |
| ---------- | ------ | -------- | --------------------------------------------- |
| `markdown` | string | ✅       | Markdown content (≤ 2 MB; remote images only) |
| `name`     | string | no       | Logical file name (default `document.md`)     |

Returns `{ id, url }`.

### Claude.ai

1. Settings → **Connectors** → **Add custom connector**
2. Name: `mote`; Remote MCP server URL: `https://mote.flc.io/api/mcp`
3. Advanced settings → add header: `Authorization: Bearer <your-token>`

### Generic client (`.mcp.json`)

```json
{
  "mcpServers": {
    "mote": {
      "type": "http",
      "url": "https://mote.flc.io/api/mcp",
      "headers": { "Authorization": "Bearer <your-token>" }
    }
  }
}
```

### Codex

```bash
codex mcp add mote --url https://mote.flc.io/api/mcp --bearer-token-env-var MOTE_TOKEN
```

This reads the token from the `MOTE_TOKEN` environment variable, so the secret never lands in `config.toml`.

## Local MCP (stdio)

The local server additionally exposes `publish_markdown_file`, which runs the CLI's asset scanning chain (local images uploaded and deduplicated automatically).

Build:

```bash
pnpm --filter @mote/mcp build
```

Configure:

```json
{
  "mcpServers": {
    "mote": {
      "command": "node",
      "args": ["<repo>/apps/mcp/dist/mcp.js"]
    }
  }
}
```

The token is read from `~/.config/mote/config.json` or `MOTE_TOKEN` automatically.

### Tool: `publish_markdown_file`

| Parameter  | Type    | Required | Description                                              |
| ---------- | ------- | -------- | -------------------------------------------------------- |
| `path`     | string  | ✅       | Path to a local Markdown file                            |
| `noAssets` | boolean | no       | Publish without uploading local images (default `false`) |

Returns `{ id, url, markdownBytes, assetCount, totalBytes }`.

## Troubleshooting

- **`401 / UNAUTHORIZED`** — the token is missing or wrong. Remote: check the `Authorization` header value. Local: check `MOTE_TOKEN` / config file.
- **Tool not visible** — remote: verify the connector/`.mcp.json` entry and that the client supports remote (Streamable HTTP) servers. Local: verify the `command` path points at the built `dist/mcp.js`.
- **`no publish token configured`** (local) — set `MOTE_TOKEN` in the MCP server environment or the config file.
