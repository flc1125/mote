<a id="authentication-and-migration"></a>

# Authentication

[简体中文](zh-CN/authentication.md)

Mote supports browser login for interactive publishing, Service Tokens for automation and static tokens for token-mode instances. Production `mote.pub` uses Cloudflare Access and permits only approved publishers. Examples below use your own instance.

## Requirements

OAuth login requires an Access-enabled API with OAuth discovery and `/api/auth/session`. The CLI and local stdio server share Mote's credential store; remote MCP clients manage their own credentials.

CLI installation, local stdio builds and Worker deployment are separate operations. Installing the CLI does not upgrade a self-hosted Viewer or API. Release history and version-specific upgrade instructions are in the [changelog](../CHANGELOG.md).

## Choose a mode

Server and client settings have different values:

| Server `MOTE_AUTH_MODE` | Client `--auth-mode` / `MOTE_AUTH_MODE` | Credential                                           |
| ----------------------- | --------------------------------------- | ---------------------------------------------------- |
| `token` (legacy mode)   | `token`                                 | Existing Mote `MOTE_TOKEN`                           |
| `cloudflare-access`     | `oauth`                                 | Interactive user login and refresh token             |
| `cloudflare-access`     | `service`                               | Access Service Token Client ID **and** Client Secret |

Do not export the server value `cloudflare-access` into a CLI or stdio process. A Cloudflare management API token or Wrangler login is **not** a Mote publishing credential. Access mode never falls back to the server's old Mote token.

## User login: CLI and local stdio

Install the CLI and replace the example origin with your configured instance:

```bash
npm install -g mote-cli
mote login --api https://mote.example.com --auth-mode oauth
mote auth status --json
mote report.md --json
mote auth logout --json
```

`mote login` and `mote auth login` are equivalent. Use explicit `--api` for self-hosted login. Successful login saves the default API origin after saving credentials; subsequent commands use it unless flags, environment or configuration select another target. Remove conflicting instance/auth-mode overrides before using the flag-free commands above. Use `--api` with an **origin**, not `/api/mcp` or `/api/v1/publish`. OAuth and service modes require HTTPS. Each target has separate credentials. See [configuration selection](#configuration-selection) for the selection rules.

Login displays the authorization URL and waits: press `o` to open it in a browser, `c` to copy it, or `Ctrl+C` to cancel. It does not open a browser automatically. If desktop actions are unavailable, open the full displayed URL manually on the same computer as the CLI. `--no-browser` disables keyboard actions and uses manual link mode, but still requires an interactive terminal. See the [terminal interaction guide](cli.md#authentication-commands). Login does not support `--json`; publishing, status and logout never initiate browser login. An expired or revoked session requires an explicit `mote auth login --api <your-instance-origin>`.

Login registers a public client unless `--client-id` is supplied. The Mote CLI callback is `http://127.0.0.1:<port>/oauth/callback`; `--callback-port` fixes its port. In the tested Access setup, reusing a client with another port was rejected. Preserve the exact registered URI and port, or register a new client. Do not reuse a Codex callback for the CLI. Pending login waits up to 10 minutes; do not replay a previous authorization URL/code after a failed or cancelled attempt.

### Credential storage and refresh

- Default: system credential store, verified on macOS Keychain. Local stdio uses the same Mote store; Codex manages its own credentials independently.
- Explicit fallback: `mote auth login --api https://mote.example.com --auth-mode oauth --credential-store file`. This is **plaintext**, not encrypted storage. On macOS the auth directory must be owned by the current user with mode `0700`, and credential files with mode `0600`. There is no automatic fallback when Keychain fails. Log out of the same instance before changing backends.
- Storage metadata and locks live under `$XDG_CONFIG_HOME/mote/auth`, or `~/.config/mote/auth`. Metadata must remain intact even when secrets are in Keychain. Do not copy, print or commit this directory.
- CLI and stdio serialize refreshes using a target-specific inter-process lock. Near-expiry credentials are refreshed before use. An interrupted/uncertain refresh is not replayed; log in again when instructed.
- `auth status --offline --json` reports cached state, **not** online authentication. Online status can refresh and verifies `/api/auth/session`. `authorizationSessionExpiresAt: null` means unknown, not unlimited. The Mote CLI cannot report Codex's login status.

Verified compatibility is limited to macOS CLI/stdio and Codex CLI 0.153.4's app-server. Other MCP clients and Linux/Windows remain unverified.

## Configuration selection

Login uses `--api` → `https://mote.pub`, ignoring environment/config API targets and the remembered instance. Publishing, status and logout resolve the API URL as flags → environment → config file → remembered instance → `https://mote.pub`. Login reports conflicting environment/config API targets and explicit auth modes that would affect later publishing.

Static token and explicit auth mode use flags → environment → config file precedence. Login stores the non-secret default origin in `auth/default-api.json`; it does not rewrite `config.json`. A one-off `--api` override on other commands does not change this preference, and logout does not clear it. Auth mode is chosen separately from the presence of credentials:

1. Explicit `--auth-mode`, `MOTE_AUTH_MODE`, or `authMode` wins.
2. Otherwise, an existing OAuth profile for this target selects OAuth, including its logged-out marker.
3. Otherwise, use static token mode. Merely setting Service Token variables does **not** select service mode.

`--token` does not override an OAuth selection. Logout retains a non-secret selection marker so a stale `MOTE_TOKEN` cannot silently become active again. Explicit token mode can still be selected intentionally for a token-mode server.

If **any** of the three service environment variables is defined, the entire environment triple replaces the config file's `serviceToken` object; incomplete environment values are not filled from the file.

## Machine publishing

An administrator creates an Access Service Token for this workload and adds that specific token to a **Service Auth** policy attached only to the intended Mote application. Avoid an “Any service token” rule. Inject the secret through your runner's secret store; the following values are placeholders, not commands to paste with real secrets into shared logs or shell history:

```bash
export MOTE_AUTH_MODE="service"
export MOTE_API_URL="https://mote.example.com"
export MOTE_SERVICE_API_URL="https://mote.example.com"
export MOTE_SERVICE_CLIENT_ID="<client-id>"
export MOTE_SERVICE_CLIENT_SECRET="<client-secret>"
mote auth status --json
mote report.md --json
```

The normalized service origin must match the publishing origin. Mote sends the ID/Secret pair on each request, does not reuse Access cookies, and does not perform OAuth refresh or browser login. Missing, wrong or disabled credentials fail; no fallback to user or static-token credentials occurs. The same configuration works for local stdio. The verified remote Codex setup uses OAuth instead.

For rotation, create a replacement, authorize only the same application, update the workload secret store, verify identity and one non-sensitive publish, then disable the old token and verify rejection from both an existing and a new process. Remove old secret copies. For suspected compromise, disable immediately before recovery. Choose expiration deliberately and set a renewal reminder; do not infer Service Token expiry from the OAuth settings. See [Cloudflare Service Tokens](https://developers.cloudflare.com/cloudflare-one/access-controls/service-credentials/service-tokens/).

## Session duration, logout and revocation

Choose access-token and authorization-session durations for your deployment's risk level. Long-lived tokens increase the exposure window: a stolen token remains useful until expiry or effective revocation. Do not treat 7-day tokens or 30-day sessions as universal defaults.

Validation limits: production revocation/recovery and rollback, and full 7/30-day natural expiry remain unverified. Validate your chosen policy and recovery procedure before relying on them.

`mote auth logout` removes local Mote OAuth secrets for the selected origin only. It does not revoke Cloudflare grants, disable Service Tokens, remove static-token configuration, log out Codex, or delete published documents. `codex mcp logout <server>` similarly targets that Codex MCP login, not the Codex account. An administrator must separately revoke the appropriate Access user/application sessions or disable the machine token. Application-wide revocation affects other users of that application; verify its scope before acting. Already published capability URLs remain readable.

Every publish is immutable and creates a new document. Do not retry timeouts, 5xx responses or uncertain outcomes automatically: a write may already have succeeded. Resolve the outcome before deciding to publish again.

## Migration notes

<a id="moving-to-motepub"></a>

- [Moving to mote.pub](migrations.md#moving-to-motepub) — for clients still targeting the former default domain.

<a id="migrate-an-existing-instance"></a>

- [Migrate an existing instance to Access](migrations.md#migrate-an-existing-instance-to-access) — publisher migration, validation and rollback.
