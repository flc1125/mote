# Mote MCP Guide

Mote offers two MCP integrations with the same goal: publish Markdown → get a URL. Both share one publish pipeline with the CLI — there is no separate upload logic.

|          | Remote MCP                                            | Local MCP (stdio)                                            |
| -------- | ----------------------------------------------------- | ------------------------------------------------------------ |
| Endpoint | `POST https://mote.flc.io/api/mcp`                    | `mote-mcp` process (stdio)                                   |
| Tool     | `publish_markdown`                                    | `publish_markdown`, `publish_markdown_file`                  |
| Auth     | OAuth for Access; static Bearer for token deployments | Mote CLI OAuth store, explicit service mode, or static token |
| Verified | Codex 0.153.4 app-server on macOS                     | Actual stdio process on macOS                                |

OAuth/service support describes the unreleased source revision. Production and v0.1.1 have not been switched by this rollout. Other clients/platforms are not covered by these tests. See [authentication and migration](authentication.md).

## Remote MCP

A **stateless** Streamable HTTP endpoint (no MCP sessions, no SSE): `initialize`, `tools/list`, `tools/call` over POST; authenticated `GET` returns 405 and notifications return 202. Authentication runs before protocol handling, so anonymous requests to protected paths fail first. OAuth authorization sessions belong to Access, not the MCP Worker.

### Tool: `publish_markdown`

| Parameter  | Type   | Required | Description                                   |
| ---------- | ------ | -------- | --------------------------------------------- |
| `markdown` | string | ✅       | Markdown content (≤ 2 MB; remote images only) |
| `name`     | string | no       | Logical file name (default `document.md`)     |

Returns `{ id, url }`.

### Static-token deployments (legacy)

The following is a protocol configuration example, not a compatibility claim for every client. Protect files containing credentials and never commit real header values.

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

For the legacy token deployment:

```bash
codex mcp add mote --url https://mote.flc.io/api/mcp --bearer-token-env-var MOTE_TOKEN
```

This reads the token from the `MOTE_TOKEN` environment variable, so the secret never lands in `config.toml`.

For an **Access-enabled** instance, remove `bearer_token_env_var` and any static Authorization headers from this server entry. Configure the existing public client and exact registered callback (all values below are placeholders):

```toml
[mcp_servers.mote]
url = "https://mote.example.com/api/mcp"

[mcp_servers.mote.oauth]
client_id = "<registered-public-client-id>"
callback_url = "http://localhost:65432/callback/<server-specific-callback-id>"
callback_port = 65432
```

```bash
codex mcp login mote
codex mcp logout mote
```

Get the actual callback from your Codex setup; do not invent or copy another server's callback ID. Match both the registered URI and listening port. Use the MCP endpoint (including `/api/mcp`) as the OAuth resource. The tested integration uses a pre-registered public client because automatic registration in the earlier baseline omitted the resource required by Access. Do not add a duplicate `oauth_resource` override. Follow the [official Codex callback guidance](https://learn.chatgpt.com/zh-Hans/docs/extend/mcp).

The verified sequence is login → initialize → list tools → publish → anonymous URL read → no-browser reuse across a temporary 10-minute lifetime → application revocation refusal → logout/relogin → publish recovery. Final test settings were restored to 168h / 720h; this is not a full 7/30-day natural-expiry test. Codex stores its own tokens; Mote CLI/stdio must not read or copy them. MCP logout does not log out the Codex account or revoke Access grants.

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

Use the same OS user and `XDG_CONFIG_HOME` as the Mote CLI. After `mote auth login --api https://mote.example.com --auth-mode oauth`, set `MOTE_API_URL=https://mote.example.com` and `MOTE_AUTH_MODE=oauth` in the stdio process environment. Do not put OAuth tokens in the MCP JSON. Local tools share the Mote credential store and refresh lock; they never initiate browser login. A previously launched process reads the current credentials on each tool call, so logout causes it to refuse further OAuth publishing.

For unattended publishing, explicitly select `service` and inject the three service variables described in [machine publishing](authentication.md#machine-publishing). Static `MOTE_TOKEN`/config remains available only when token mode is selected. Environment selection belongs to the MCP parent process; changing an unrelated terminal's exports does not change it.

### Tool: `publish_markdown_file`

| Parameter  | Type    | Required | Description                                              |
| ---------- | ------- | -------- | -------------------------------------------------------- |
| `path`     | string  | ✅       | Path to a local Markdown file                            |
| `noAssets` | boolean | no       | Publish without uploading local images (default `false`) |

Returns `{ id, url, markdownBytes, assetCount, totalBytes }`.

## Troubleshooting

- **`401 / UNAUTHORIZED`** — confirm the deployment and selected auth mode. Static mode: check the configured token source without printing it; Access: check the user grant or machine policy and renew credentials explicitly.
- **Tool not visible** — remote: verify the connector/`.mcp.json` entry and that the client supports remote (Streamable HTTP) servers. Local: verify the `command` path points at the built `dist/mcp.js`.
- **`no publish token configured`** (local) — static mode requires `MOTE_TOKEN` or config `token`; an Access instance instead requires OAuth login or explicit service mode.

- **OAuth login required** — CLI/stdio: run `mote auth login` interactively for the same origin; Codex remote: use `codex mcp login mote`. Do not copy credentials between them.
- **Service configuration invalid** — provide the whole target-bound triple and explicit service mode; never fall back to OAuth.
- **Unknown publish outcome** — do not automatically repeat the call. A timeout may have occurred after the immutable write.
