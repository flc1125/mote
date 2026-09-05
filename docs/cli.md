# Mote CLI Reference

The `mote` CLI publishes a local Markdown file to a Mote instance and prints its URL.

OAuth/Service Token commands below describe the **unreleased source**, not v0.1.1. Build the reviewed revision for an Access-enabled deployment. See [authentication and migration](authentication.md) for setup, secure storage and mode selection.

```bash
mote <markdown-file>
# equivalent to
mote publish <markdown-file>
```

## Installation

```bash
npm install -g mote-cli
```

**From source** (requires Node.js ≥ 20 and pnpm):

```bash
git clone https://github.com/flc1125/mote.git
cd mote
pnpm install
pnpm --filter @mote/cli build
cd apps/cli && npm install -g .
```

Verify:

```bash
mote --help
```

## Configuration

Resolution order (highest priority first):

```text
CLI arguments  >  environment variables  >  config file  >  defaults
```

| Setting        | CLI argument         | Environment variable         | Config file key             | Default                                     |
| -------------- | -------------------- | ---------------------------- | --------------------------- | ------------------------------------------- |
| API URL        | `--api <url>`        | `MOTE_API_URL`               | `apiUrl`                    | `https://mote.flc.io`                       |
| Token          | `--token <token>`    | `MOTE_TOKEN`                 | `token`                     | —                                           |
| Auth mode      | `--auth-mode <mode>` | `MOTE_AUTH_MODE`             | `authMode`                  | OAuth profile if present; otherwise `token` |
| Service target | —                    | `MOTE_SERVICE_API_URL`       | `serviceToken.apiUrl`       | —                                           |
| Service ID     | —                    | `MOTE_SERVICE_CLIENT_ID`     | `serviceToken.clientId`     | —                                           |
| Service secret | —                    | `MOTE_SERVICE_CLIENT_SECRET` | `serviceToken.clientSecret` | —                                           |

Config file location: `$XDG_CONFIG_HOME/mote/config.json` (usually `~/.config/mote/config.json`):

```json
{
  "apiUrl": "https://mote.flc.io",
  "token": "your-token"
}
```

Recommended permissions: `chmod 600 ~/.config/mote/config.json`. The token is never written to logs, stdout, or error messages.

Use an API **origin** (for example `https://mote.example.com`), not an endpoint path. Client modes are `token`, `oauth` and `service`; the server-only value `cloudflare-access` is not valid here. Explicit mode wins; absent a mode, even a logged-out OAuth profile prevents fallback to an old token. Defining any service environment variable replaces the entire service config triple. See [selection rules](authentication.md#configuration-selection).

## Authentication commands

```bash
mote auth login --api https://mote.example.com --auth-mode oauth
mote auth status --api https://mote.example.com --json
mote auth status --api https://mote.example.com --offline --json
mote auth logout --api https://mote.example.com --json
```

Login requires an interactive terminal and rejects `--json`. `--no-browser` prints the login URL but is still interactive. `--client-id <public-id>` reuses a registration; keep its exact callback port using `--callback-port <port>`. Default storage is Keychain on verified macOS; `--credential-store file` explicitly opts into private plaintext files. There is no automatic fallback. See [storage and refresh](authentication.md#credential-storage-and-refresh).

Online status verifies identity and may refresh; offline status reports cache only (`authenticated: null`). Status JSON contains mode, source, expiry if known, storage and identity, not tokens. Logout JSON includes `loggedOut: true` and `remoteRevoked: false`; it removes local OAuth credentials only and retains an OAuth selection marker. Static/service credentials and Codex credentials are unchanged.

## Options

| Option          | Description                                                      |
| --------------- | ---------------------------------------------------------------- |
| `--json`        | Print only `{"id","url"}` on stdout — for agents, CI and scripts |
| `--token`       | Publish token (overrides `MOTE_TOKEN`)                           |
| `--auth-mode`   | Select `token`, `oauth` or `service`; no implicit fallback       |
| `--api`         | API base URL (overrides `MOTE_API_URL`)                          |
| `--no-assets`   | Publish Markdown only; skip local images                         |
| `--verbose`     | Verbose progress on stderr                                       |
| `-h, --help`    | Show help                                                        |
| `-v, --version` | Show version                                                     |

Human output with `--verbose` (progress goes to stderr; without it only the final result is printed):

```text
Scanning README.md...

Markdown    47.1 KB
Assets      3
Total       1.84 MB

Published:
https://mote.flc.io/7Vk3mQ9x2NFaP4Ls
```

Machine output (`--json`, only content on stdout):

```json
{ "id": "7Vk3mQ9x2NFaP4Ls", "url": "https://mote.flc.io/7Vk3mQ9x2NFaP4Ls" }
```

Scripting:

```bash
URL=$(mote report.md --json | jq -r .url)
```

## How assets are handled

The CLI parses the Markdown **AST** (never regex) and collects local image references — inline (`![a](./a.png)`), reference-style (`![a][img]`), shortcut (`![img]`), and images nested in links.

For each referenced file it then: resolves the absolute path → checks existence → requires a regular file → detects MIME **by magic bytes** → checks size → computes SHA-256 → **deduplicates by content** (the same image under different names uploads once; every spelling is recorded).

- Remote URLs (`https://…`) are left untouched
- Only files actually referenced are read — directories are never scanned
- Unsupported formats (SVG, etc.) fail with a clear error
- The public asset URL never contains the original file name

Publishing prepares authentication before reading the input bundle. It never opens a browser. Successful publish `--json` stdout remains exactly `{id,url}`; failures use stderr and exit code 1. Do not automatically retry unknown write outcomes.

## Troubleshooting

| Error                             | Cause / fix                                                           |
| --------------------------------- | --------------------------------------------------------------------- |
| `no publish token configured`     | Set `MOTE_TOKEN`, pass `--token`, or add `"token"` to the config file |
| `asset not found: <path>`         | A referenced image does not exist; fix the relative path              |
| `unsupported image type`          | SVG or non-image referenced; convert to png/webp                      |
| `markdown is … bytes, limit is …` | Markdown over 2 MB — split the document                               |
| `UNAUTHORIZED`                    | Wrong or expired token                                                |
| `BUNDLE_TOO_LARGE`                | Bundle exceeds a size limit (see README limits)                       |

- **Login required / refresh pending**: explicitly run `mote auth login` for the same API. Do not delete metadata to reactivate an old token.
- **Service mode requires matching variables**: set all three service variables, explicitly select `service`, and match the API origin. Do not paste secrets into bug reports.
- **Keyring or permissions error**: fix the system credential store or use an explicitly chosen private file backend after logout; no silent fallback is performed.
- **Callback mismatch / port occupied**: reuse the exact registered URI and available fixed port, or register a new client. Start a fresh login instead of replaying a previous code.
- **Online status on an older server**: `/api/auth/session` requires the matching server implementation; a failure is not evidence that an older static-token publisher is broken.
