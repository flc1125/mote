# Mote CLI Reference

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

Use an API **origin** (for example `https://mote.example.com`), not an endpoint path. Client modes are `token`, `oauth` and `service`; the server-only value `cloudflare-access` is not valid here. Explicit mode wins; absent a mode, even a logged-out OAuth profile prevents fallback to an old token. Defining any service environment variable replaces the entire service config triple. See [selection rules](authentication.md#configuration-selection).

## Authentication commands

```bash
mote login --api https://mote.example.com --auth-mode oauth
mote auth status --api https://mote.example.com --json
mote auth status --api https://mote.example.com --offline --json
mote auth logout --api https://mote.example.com --json
```

`mote login` is an alias for `mote auth login`; both remain supported. After credentials are saved successfully, login remembers the API origin in `auth/default-api.json`. You can then run `mote README.md` without `--api`, unless environment or config overrides select another instance. Explicit auth-mode settings still apply; a one-off `--api` publish does not change the saved default. Logout retains the default and OAuth selection marker but removes the selected target's OAuth credentials.

Login requires an interactive terminal and rejects `--json`. It displays the full
authorization URL and waits for you to choose an action; it does not open a
browser automatically. Press `o` to open the link, `c` to copy it, or `Ctrl+C` to
cancel. Opening or copying failures leave the link available for manual use.
`--no-browser` selects manual link mode without keyboard actions. Output redirected
to a file or a `TERM=dumb` terminal also uses manual mode; stdin must still be a TTY.
Open the link in a browser on the same computer as the CLI, because authorization
returns to its loopback callback. Keep the command running until it confirms that
credentials have been saved.

```text
Mote · Sign in

Instance  https://mote.example.com

Open this link to authorize:
<full authorization URL>

[o] Open browser   [c] Copy link   [Ctrl+C] Cancel

Waiting for authorization…
```

The terminal reports browser/clipboard actions, then verification and credential
storage, and finally success or an error. Human-readable status uses labeled fields;
`--offline` explicitly identifies unverified cached state. Colors are disabled for
redirected output, `TERM=dumb`, or when `NO_COLOR` is set. URLs are never truncated
or manually wrapped, including in narrow terminals. Machine-readable `--json`
results and exit codes are unchanged.

`--client-id <public-id>` reuses a registration; keep its exact callback port using `--callback-port <port>`. Default storage is Keychain on verified macOS; `--credential-store file` explicitly opts into private plaintext files. There is no automatic fallback. See [storage and refresh](authentication.md#credential-storage-and-refresh).

Online status verifies identity and may refresh; offline status reports cache only (`authenticated: null`). Status JSON contains mode, source, expiry if known, storage and identity, not tokens. Logout JSON includes `loggedOut: true` and `remoteRevoked: false`; it removes local OAuth credentials only and retains an OAuth selection marker. Static/service credentials and Codex credentials are unchanged.

## Options

| Option          | Description                                                         |
| --------------- | ------------------------------------------------------------------- |
| `--json`        | Print only `{"id","url"}` on stdout — for agents, CI and scripts    |
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

The CLI parses the Markdown **AST** and collects local image references — inline (`![a](./a.png)`), reference-style (`![a][img]`), shortcut (`![img]`), and images nested in links. An HTML tokenizer also collects `img src`, `img srcset` and `source srcset`, including images inside `picture` and `details`.

Paths resolve relative to the Markdown file's directory. Unicode, spaces and percent-encoded references are supported. Recognized front matter and mathematical source do not contribute image references. See [Markdown compatibility](markdown.md#images-and-html).

Each referenced file must exist, be a regular file and have a supported MIME type detected **by magic bytes**. Images are hashed and **deduplicated by content**: the same image under different names uploads once, with every reference spelling recorded. The resulting bundle is checked against size and count limits before upload.

- Remote HTTP(S) URLs are retained, not downloaded or bundled
- Only files actually referenced are read — directories are never scanned
- Unsupported formats (SVG, etc.) fail with a clear error
- The public asset URL never contains the original file name

`--no-assets` skips local image collection and upload but does not remove or replace image references. Those local images generally will not resolve for online readers; use remote HTTP(S) images or upload the local assets when readers need them. Links to other local Markdown files do not publish those files.

Upload limits use binary units: Markdown ≤ 2 MiB, each image ≤ 10 MiB, the bundle ≤ 20 MiB and at most 50 uploaded assets. The count is after CLI deduplication; remote images do not count. Byte values and server errors are defined in the [publish protocol](protocol.md#大小与数量限额).

Publishing prepares authentication before reading the input bundle. It never opens a browser. Successful publish `--json` stdout remains exactly `{id,url}`; failures use stderr and exit code 1. Do not automatically retry unknown write outcomes.

## Troubleshooting

| Error                             | Cause / fix                                                           |
| --------------------------------- | --------------------------------------------------------------------- |
| `no publish token configured`     | Set `MOTE_TOKEN`, pass `--token`, or add `"token"` to the config file |
| `asset not found: <path>`         | A referenced image does not exist; fix the relative path              |
| `unsupported image type`          | SVG or non-image referenced; convert to png/webp                      |
| `markdown is … bytes, limit is …` | Markdown over 2 MiB — split the document                              |
| `UNAUTHORIZED`                    | Wrong or expired token                                                |
| `BUNDLE_TOO_LARGE`                | Bundle exceeds a size limit (see README limits)                       |

- **Login required / refresh pending**: explicitly run `mote auth login --api <your-instance-origin> --auth-mode oauth` for the same API. Do not delete metadata to reactivate an old token.
- **Service mode requires matching variables**: set all three service variables, explicitly select `service`, and match the API origin. Do not paste secrets into bug reports.
- **Keyring or permissions error**: fix the system credential store or use an explicitly chosen private file backend after logout; no silent fallback is performed.
- **Callback mismatch / port occupied**: reuse the exact registered URI and available fixed port, or register a new client. Start a fresh login instead of replaying a previous code.
- **Online status on an older server**: `/api/auth/session` requires the matching server implementation; a failure is not evidence that an older static-token publisher is broken.
