# Mote CLI Reference

The `mote` CLI publishes a local Markdown file to a Mote instance and prints its URL.

OAuth/Service Token commands and the `mote login` shortcut require **mote-cli v0.2.0 or the matching source build**; v0.1.1 does not include them. Use an Access-enabled deployment for OAuth/service authentication. See [authentication and migration](authentication.md) for setup, secure storage and mode selection.

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
API URL: CLI arguments > environment variables > config file > remembered instance > default
Other settings: CLI arguments > environment variables > config file > defaults
```

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
authorization URL and waits for you to choose an action; it no longer opens a
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
| `--no-assets`   | Publish Markdown only; skip local images                            |
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
