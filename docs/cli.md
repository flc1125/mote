# Mote CLI Reference

[简体中文](zh-CN/cli.md)

The `mote` CLI publishes a local Markdown file to a Mote instance and prints its URL.

Use an Access-enabled deployment for OAuth/service authentication. See [authentication](authentication.md) for setup, secure storage and mode selection, and the [changelog](../CHANGELOG.md) for version-specific upgrade notes.

```bash
mote <markdown-file>
# equivalent to
mote publish <markdown-file>
```

## Installation

```bash
npm install -g mote-cli
```

**From source** (recommended development environment: Node.js 24 and the pnpm version pinned in the root `package.json`):

```bash
git clone https://github.com/flc1125/mote.git
cd mote
pnpm install --frozen-lockfile
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
Login API URL: --api > built-in default (https://mote.pub)
Other commands API URL: CLI arguments > environment variables > config file > remembered instance > default
Other settings: CLI arguments > environment variables > config file > defaults
```

`mote login` and `mote auth login` ignore `MOTE_API_URL`, config `apiUrl` and the remembered instance when choosing the login target. Use `--api` to log in to a self-hosted instance. Successful login remembers that target for subsequent commands; environment and config overrides still take precedence when publishing. Login warns when those overrides select a different publishing instance.

| Setting        | CLI argument         | Environment variable         | Config file key             | Default                                     |
| -------------- | -------------------- | ---------------------------- | --------------------------- | ------------------------------------------- |
| API URL        | `--api <url>`        | `MOTE_API_URL`               | `apiUrl`                    | `https://mote.pub`                          |
| Token          | `--token <token>`    | `MOTE_TOKEN`                 | `token`                     | —                                           |
| Auth mode      | `--auth-mode <mode>` | `MOTE_AUTH_MODE`             | `authMode`                  | OAuth profile if present; otherwise `token` |
| Service target | —                    | `MOTE_SERVICE_API_URL`       | `serviceToken.apiUrl`       | —                                           |
| Service ID     | —                    | `MOTE_SERVICE_CLIENT_ID`     | `serviceToken.clientId`     | —                                           |
| Service secret | —                    | `MOTE_SERVICE_CLIENT_SECRET` | `serviceToken.clientSecret` | —                                           |

Config file location: `$XDG_CONFIG_HOME/mote/config.json` (usually `~/.config/mote/config.json`). This example targets your own token-mode instance; replace the host. Production `mote.pub` requires Access authentication:

```json
{
  "apiUrl": "https://mote.example.com",
  "authMode": "token",
  "token": "your-token"
}
```

Recommended permissions: `chmod 600 ~/.config/mote/config.json`. The token is never written to logs, stdout, or error messages.

Use an API **origin**, such as `https://mote.example.com`, without an endpoint path.
Client modes are `token`, `oauth` and `service`. The server-only value `cloudflare-access` is not valid here.

An explicit mode takes precedence. Without one, an OAuth profile selects OAuth even after logout, preventing fallback to an old token.
Defining any service environment variable makes all three service settings come from the environment, replacing the file's service configuration.
Missing environment values are not filled from the file. See [selection rules](authentication.md#configuration-selection).

## Authentication commands

```bash
mote login --api https://mote.example.com --auth-mode oauth
mote auth status --api https://mote.example.com --json
mote auth status --api https://mote.example.com --offline --json
mote auth logout --api https://mote.example.com --json
```

`mote login` is an alias for `mote auth login`. After saving credentials, login remembers the API origin in `auth/default-api.json`.
You can then run `mote README.md` without `--api`, unless environment variables or configuration select another instance.
Explicit auth-mode settings still apply. Using `--api` for one publication does not change the saved default.

### Login steps

Login requires an interactive terminal and rejects `--json`. It displays the full authorization URL and waits; it does not open a browser automatically.

1. Press `o` to open the link, or `c` to copy it. Press `Ctrl+C` to cancel.
2. If opening or copying fails, open the displayed link manually on the same computer as the CLI.
3. Complete browser authorization. Keep the command running until it confirms that credentials have been saved.

Authorization returns to the CLI through a local callback, so the browser must run on the same computer.

```text
Mote · Sign in

Instance  https://mote.example.com

Open this link to authorize:
<full authorization URL>

[o] Open browser   [c] Copy link   [Ctrl+C] Cancel

Waiting for authorization…
```

The terminal reports browser or clipboard actions, verification, credential storage, and finally success or an error.

### Terminal requirements

`--no-browser` selects manual link mode without keyboard actions. Redirected output or `TERM=dumb` also selects manual mode.
In every mode, stdin must be a TTY, meaning an interactive terminal input.

Colors are disabled for redirected output, `TERM=dumb`, or when `NO_COLOR` is set.
URLs are never truncated or manually wrapped, including in narrow terminals.
Use `--json` for machine-readable status or logout results; login does not support this option.

### Credentials and status

`--client-id <public-id>` reuses a registration; keep its exact callback port using `--callback-port <port>`. Default storage is Keychain on verified macOS; `--credential-store file` explicitly opts into private plaintext files. There is no automatic fallback. See [storage and refresh](authentication.md#credential-storage-and-refresh).

Online status verifies identity and may refresh credentials. Offline status reports unverified cached state only (`authenticated: null`).
Human-readable status uses labeled fields. Status JSON contains mode, source, expiry if known, storage and identity, not tokens.

Logout removes the selected target's local OAuth credentials. It retains the default instance and OAuth selection marker.
Logout JSON includes `loggedOut: true` and `remoteRevoked: false`.
Logout does not change static/service credentials or Codex credentials, and does not revoke remote authorization.

## Options

These options apply to publishing. Login, status and logout have separate options described under [Authentication commands](#authentication-commands).

| Option          | Description                                                         |
| --------------- | ------------------------------------------------------------------- |
| `--json`        | Print a JSON object containing only `id` and `url` on stdout        |
| `--token`       | Publish token (overrides `MOTE_TOKEN`)                              |
| `--auth-mode`   | Select `token`, `oauth` or `service`; no implicit fallback          |
| `--api`         | API base URL (overrides `MOTE_API_URL`)                             |
| `--no-assets`   | Skip local-image uploads; preserve the original Markdown references |
| `--verbose`     | Show progress even when stderr is redirected; ignored with `--json` |
| `-h, --help`    | Show help                                                           |
| `-v, --version` | Show version                                                        |

Human output in a terminal (progress and the summary go to stderr; the final result goes to stdout):

```text
Scanning README.md…

Markdown  47.1 KB
Assets    3
Total     1.8 MB

Publishing…
Published:
https://mote.example.com/7Vk3mQ9x2NFaP4Ls
```

The summary appears after scanning and validation, before the upload starts.
The terminal currently labels binary sizes as KB/MB; the limits in this reference
use KiB/MiB to make the byte values explicit.
`Assets` counts local images after content deduplication; remote images are not
included. `Total` is the Markdown plus those image bytes, excluding multipart and
manifest overhead. `--no-assets` shows `0 (skipped)` and a Markdown-only total.

When stderr is not a terminal, progress is hidden by default; use `--verbose` to
include it in logs. Redirecting stdout alone does not hide progress on a terminal's
stderr. `--json` suppresses all progress, including with `--verbose`. Failed scans
print an error without a content summary; failed uploads never print `Published`.

Machine output (`--json`, only content on stdout):

```json
{ "id": "7Vk3mQ9x2NFaP4Ls", "url": "https://mote.example.com/7Vk3mQ9x2NFaP4Ls" }
```

Scripting:

```bash
URL=$(mote report.md --json | jq -r .url)
```

## How assets are handled

The CLI parses the Markdown **abstract syntax tree (AST)** and collects local image references — inline (`![a](./a.png)`), reference-style (`![a][img]`), shortcut (`![img]`), and images nested in links. An HTML tokenizer also collects `img src`, `img srcset` and `source srcset`, including images inside `picture` and `details`.

Paths resolve relative to the Markdown file's directory. Unicode, spaces and percent-encoded references are supported. Recognized front matter and mathematical source do not contribute image references. See [Markdown compatibility](markdown.md#images-and-html).

Each referenced file must exist, be a regular file and have a supported MIME type detected **by magic bytes**. Images are hashed and **deduplicated by content**: the same image under different names uploads once, with every reference spelling recorded. The resulting bundle is checked against size and count limits before upload.

- Remote HTTP(S) URLs are retained, not downloaded or bundled
- Only files actually referenced are read — directories are never scanned
- Unsupported formats (SVG, etc.) fail with a clear error
- The public asset URL never contains the original file name

`--no-assets` skips local image collection and upload but does not remove or replace image references. Those local images generally will not resolve for online readers; use remote HTTP(S) images or upload the local assets when readers need them. Links to other local Markdown files do not publish those files.

Upload limits use binary units: Markdown ≤ 2 MiB, each image ≤ 10 MiB, the bundle ≤ 20 MiB and at most 50 uploaded assets. The count is after CLI deduplication; remote images do not count. Byte values and server errors are defined in the [publish protocol](protocol.md#大小与数量限额).

Publishing prepares authentication before reading the input bundle. It never opens a browser.
On success, `--json` writes a JSON object containing only `id` and `url` to stdout.
Failures use stderr and exit code 1. Do not automatically retry unknown publication outcomes.

## Troubleshooting

| Error                             | Cause / fix                                                                                         |
| --------------------------------- | --------------------------------------------------------------------------------------------------- |
| `no publish token configured`     | In token mode, configure the instance's token. For Access, select OAuth or service mode; see below. |
| `asset not found: <path>`         | A referenced image does not exist; fix the relative path                                            |
| `unsupported image type`          | SVG or non-image referenced; convert to png/webp                                                    |
| `markdown is … bytes, limit is …` | Markdown over 2 MiB — split the document                                                            |
| `UNAUTHORIZED`                    | Credentials were rejected. Check the instance and selected auth mode; see below.                    |
| `publish failed: HTTP 413`        | A request size or asset count exceeds a limit; see [upload limits](protocol.md#大小与数量限额).     |

The table quotes message prefixes; the CLI may append more text.
REST error codes such as `BUNDLE_TOO_LARGE` belong to the [server protocol](protocol.md#错误), not the CLI's displayed messages.

### Authentication failures

- **Token mode:** check the instance's `MOTE_TOKEN`, `--token` or config `token` without printing the value.
- **OAuth mode:** run `mote auth login --api <your-instance-origin> --auth-mode oauth` for the same instance.
- **Service mode:** check the Client ID, Client Secret, matching instance origin and the application's Service Auth policy.

For more specific authentication errors:

- **Login required / refresh pending**: explicitly run `mote auth login --api <your-instance-origin> --auth-mode oauth` for the same API. Do not delete metadata to reactivate an old token.
- **Service mode requires matching variables**: set all three service variables, explicitly select `service`, and match the API origin. Do not paste secrets into bug reports.
- **Keyring or permissions error**: fix the system credential store or use an explicitly chosen private file backend after logout; no silent fallback is performed.
- **Callback mismatch / port occupied**: reuse the exact registered URI and available fixed port, or register a new client. Start a fresh login instead of replaying a previous code.
- **Online status on an older server**: `/api/auth/session` requires the matching server implementation; a failure is not evidence that an older static-token publisher is broken.

### Unknown publication outcome

A timeout, server error or invalid response can occur after the document was stored. The CLI does not automatically retry uploads.

1. Check stdout for a returned document URL. If present, open it and check the expected document.
2. If no URL was returned, preserve the error, request time and instance address. Ask the instance administrator to investigate.
3. If the outcome cannot be confirmed, report that uncertainty. Another publication may create a duplicate document; review this risk before publishing again.

Do not include credentials or private document URLs in shared logs or bug reports.
`mote auth status` checks authentication; it does not query publication outcomes or recover a missing URL.
