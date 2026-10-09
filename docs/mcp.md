# Mote MCP Guide

Mote offers remote and local MCP integrations. Both publish Markdown and return a URL.
Local MCP reuses the CLI publishing pipeline. Remote MCP reuses the API Worker's validation and storage pipeline.

|          | Remote MCP                                            | Local MCP (stdio)                                            |
| -------- | ----------------------------------------------------- | ------------------------------------------------------------ |
| Endpoint | `POST https://mote.pub/api/mcp`                       | `mote-mcp` process (stdio)                                   |
| Tool     | `publish_markdown`                                    | `publish_markdown`, `publish_markdown_file`                  |
| Auth     | OAuth for Access; static Bearer for token deployments | Mote CLI OAuth store, explicit service mode, or static token |
| Verified | Codex 0.153.4 app-server on macOS                     | Actual stdio process on macOS                                |

Production `mote.pub` uses Access. Client/platform verification is listed above; [authentication](authentication.md) covers setup, credential storage and validation limits.

## Remote MCP

The Streamable HTTP endpoint is **stateless**: it has no MCP sessions or SSE stream.
It accepts `initialize`, `tools/list` and `tools/call` over POST. Authenticated GET requests return 405; notifications return 202.

Authentication runs before protocol handling, so anonymous requests to protected paths fail first.
OAuth authorization sessions belong to Access, not the MCP Worker.

### Tool: `publish_markdown`

| Parameter  | Type   | Required | Description                                                   |
| ---------- | ------ | -------- | ------------------------------------------------------------- |
| `markdown` | string | ✅       | Markdown content (≤ 2 MiB of UTF-8 bytes; remote images only) |
| `name`     | string | no       | Logical file name (default `document.md`)                     |

Returns `{ id, url }`.

### Codex

For an **Access-enabled** instance, remove `bearer_token_env_var` and any static Authorization headers from the server entry.
Configure the existing public client and exact registered callback. All values below are placeholders:

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
```

Get the actual callback from your Codex setup; do not invent or copy another server's callback ID. Match both the registered URI and listening port. Use the MCP endpoint (including `/api/mcp`) as the OAuth resource. This configuration uses a pre-registered public client; do not add a duplicate `oauth_resource` override. Follow the [official Codex callback guidance](https://learn.chatgpt.com/zh-Hans/docs/extend/mcp).

Codex stores its own tokens; Mote CLI/stdio must not read or copy them.
Use `codex mcp logout mote` to remove that MCP login. This does not log out the Codex account or revoke Access grants.

Verify login, tool discovery, publishing and anonymous reading against your own instance.
Use a non-sensitive document: each publication creates an immutable document with no user-facing deletion endpoint.

<a id="static-token-deployments-legacy"></a>

### Static-token deployments

Token mode remains available for self-hosted instances. Production `mote.pub` does not accept static tokens.
The following is a configuration example, not a compatibility claim for every client.
Protect files containing credentials and never commit real header values.

```json
{
  "mcpServers": {
    "mote": {
      "type": "http",
      "url": "https://mote.example.com/api/mcp",
      "headers": { "Authorization": "Bearer <your-token>" }
    }
  }
}
```

For Codex, replace the example host with your own token-mode instance:

```bash
codex mcp add mote --url https://mote.example.com/api/mcp --bearer-token-env-var MOTE_TOKEN
```

This reads the token from `MOTE_TOKEN` instead of writing the secret into `config.toml`.

## Local MCP (stdio)

The local server additionally exposes `publish_markdown_file`, which runs the CLI's asset scanning chain (local images uploaded and deduplicated automatically).

The local MCP server is a private workspace package; installing `mote-cli` does not install `mote-mcp`. Build it from source using Node.js 24 and the pnpm version pinned in the root `package.json`:

```bash
git clone https://github.com/flc1125/mote.git
cd mote
pnpm install --frozen-lockfile
pnpm --filter @mote/mcp build
```

Replace `<repo>` below with the absolute path to that checkout. Configure:

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

Use the same OS user and `XDG_CONFIG_HOME` as the Mote CLI. For OAuth:

1. Run `mote login --api https://mote.example.com --auth-mode oauth` interactively.
2. Set `MOTE_API_URL=https://mote.example.com` and `MOTE_AUTH_MODE=oauth` in the stdio process environment.

Do not put OAuth tokens in the MCP JSON. Local tools share the Mote credential store and refresh lock; they never initiate browser login.
Each tool call reads current credentials. After logout, even an already-running process refuses further OAuth publishing.

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

- **OAuth login required** — CLI/stdio: run `mote auth login --api <your-instance-origin> --auth-mode oauth` interactively for the same origin; Codex remote: use `codex mcp login mote`. Do not copy credentials between them.
- **Service configuration invalid** — set the service API origin, Client ID and Client Secret, and explicitly select service mode. Never fall back to OAuth.
- **Unknown publish outcome** — do not automatically repeat the call. The document may have been stored; follow [Unknown publication outcome](cli.md#unknown-publication-outcome).
