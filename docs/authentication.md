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
| `token`                 | `token`                                 | Static Mote `MOTE_TOKEN`                             |
| `cloudflare-access`     | `oauth`                                 | Interactive user login and refresh token             |
| `cloudflare-access`     | `service`                               | Access Service Token Client ID **and** Client Secret |

Do not export the server value `cloudflare-access` into a CLI or stdio process. A Cloudflare management API token or Wrangler login is **not** a Mote publishing credential. Access mode never falls back to the server's old Mote token.

## User login: CLI and local stdio

Install the CLI. Replace the example origin with your instance, and create a non-sensitive document named `report.md`.
Remove conflicting instance or auth-mode settings before using commands without `--api`; see [configuration selection](#configuration-selection).

```bash
npm install -g mote-cli
mote login --api https://mote.example.com --auth-mode oauth
mote auth status --json
mote report.md --json
```

`mote login` and `mote auth login` are equivalent. For self-hosted login, supply `--api` explicitly.
Use an **origin**, such as `https://mote.example.com`, without `/api/mcp` or `/api/v1/publish`.
OAuth and service modes require HTTPS. Each target has separate credentials.

After saving credentials, login remembers the default API origin. Subsequent commands use it unless arguments, environment variables or configuration select another target.

### Complete browser login

Login displays the authorization URL and waits. It does not open a browser automatically.

1. Press `o` to open the link, or `c` to copy it. Press `Ctrl+C` to cancel.
2. If those actions fail, open the displayed URL manually on the same computer as the CLI.
3. Complete browser authorization. Keep the command running until it confirms that credentials have been saved.

`--no-browser` disables keyboard actions and uses manual link mode. It still requires an interactive terminal.
Login does not support `--json`. See the [terminal interaction guide](cli.md#authentication-commands).

Publishing, status and logout never initiate browser login. For an expired or revoked session, run `mote auth login --api <your-instance-origin>` explicitly.

Login registers a public client unless `--client-id` is supplied. The Mote CLI callback is `http://127.0.0.1:<port>/oauth/callback`; `--callback-port` fixes its port.
In the tested Access setup, reusing a client with another port was rejected.

Preserve the exact registered URI and port, or register a new client. Do not reuse a Codex callback for the CLI.
Login waits up to 10 minutes. After a failed or cancelled attempt, start a new login instead of reusing its authorization URL or code.

### Credential storage and refresh

- **System storage:** the default credential store is verified on macOS Keychain.
  Local stdio uses the same Mote store; Codex manages its own credentials.
- **File storage:** select it explicitly with `--credential-store file` during login.
  This is **plaintext**, not encrypted storage. There is no automatic fallback when Keychain fails.
  On macOS, the auth directory must be owned by the current user with mode `0700`; credential files require mode `0600`.
  Log out of the same instance before changing storage backends.
- **Metadata and locks:** these live under `$XDG_CONFIG_HOME/mote/auth`, or `~/.config/mote/auth`.
  Keep metadata intact even when credentials are in Keychain. Do not copy, print or commit this directory.
- **Refresh:** CLI and stdio serialize refreshes using a target-specific inter-process lock.
  Near-expiry credentials are refreshed before use. An interrupted or uncertain refresh is not replayed; log in again when instructed.
- **Status:** `mote auth status --offline --json` reports cached state, **not** online authentication.
  Online status can refresh credentials and verifies `/api/auth/session`.
  `authorizationSessionExpiresAt: null` means unknown, not unlimited. The Mote CLI cannot report Codex's login status.

Verified compatibility is limited to macOS CLI/stdio and Codex CLI 0.153.4's app-server. Other MCP clients and Linux/Windows remain unverified.

## Configuration selection

API URL selection, in priority order:

| Command                       | Selection order                                                              |
| ----------------------------- | ---------------------------------------------------------------------------- |
| Login                         | `--api` → `https://mote.pub`                                                 |
| Publishing, status and logout | Flags → environment → config file → remembered instance → `https://mote.pub` |

Login ignores environment/config API targets and the remembered instance.
It reports conflicting environment/config API targets and explicit auth modes that would affect later publishing.

Static token and explicit auth mode use flags → environment → config file precedence.
Login stores the non-secret default origin in `auth/default-api.json`; it does not rewrite `config.json`.
Using `--api` for one command does not change this preference. Logout does not clear it.

Auth mode is chosen separately from the presence of credentials:

1. Explicit `--auth-mode`, `MOTE_AUTH_MODE`, or `authMode` wins.
2. Otherwise, an existing OAuth profile for this target selects OAuth, including its logged-out marker.
3. Otherwise, use static token mode. Merely setting Service Token variables does **not** select service mode.

`--token` does not override an OAuth selection. Logout retains a non-secret selection marker so a stale `MOTE_TOKEN` cannot silently become active again. Explicit token mode can still be selected intentionally for a token-mode server.

If **any** service environment variable is defined, all three service settings are taken from the environment.
They replace the config file's `serviceToken` object. Missing environment values are not filled from the file.

## Machine publishing

An administrator creates an Access Service Token for the workload.
The administrator adds that specific token to a **Service Auth** policy attached only to the intended Mote application.
Avoid an “Any service token” rule.

Inject the secret through your runner's secret store. The values below are placeholders.
Do not paste real secrets into shared logs or shell history.

```bash
export MOTE_AUTH_MODE="service"
export MOTE_API_URL="https://mote.example.com"
export MOTE_SERVICE_API_URL="https://mote.example.com"
export MOTE_SERVICE_CLIENT_ID="<client-id>"
export MOTE_SERVICE_CLIENT_SECRET="<client-secret>"
mote auth status --json
mote report.md --json
```

The normalized service origin must match the publishing origin. Mote sends the Client ID and Client Secret on each request.
It does not reuse Access cookies, refresh OAuth credentials or initiate browser login.
Missing, wrong or disabled credentials fail. There is no fallback to user or static-token credentials.

The same configuration works for local stdio. The verified remote Codex setup uses OAuth instead.

### Rotate a Service Token

If you suspect compromise, disable the affected token immediately before starting recovery. For planned rotation:

1. Create a replacement Service Token.
2. Authorize the replacement token for the same Mote application only.
3. Update the credentials in the workload's secret store.
4. Verify the workload's identity.
5. Publish a non-sensitive test document.
6. Disable the old token.
7. Confirm that existing and new processes cannot publish with the old credentials.
8. Remove old secret copies.

Choose an expiration time and set a renewal reminder. Service Token expiry is separate from the OAuth settings.
See [Cloudflare Service Tokens](https://developers.cloudflare.com/cloudflare-one/access-controls/service-credentials/service-tokens/).

## Session duration, logout and revocation

Choose access-token and authorization-session durations for your deployment's risk level. Long-lived tokens increase the exposure window: a stolen token remains useful until expiry or effective revocation. Do not treat 7-day tokens or 30-day sessions as universal defaults.

Validation limits: production revocation/recovery and rollback, and full 7/30-day natural expiry remain unverified. Validate your chosen policy and recovery procedure before relying on them.

`mote auth logout --json` removes local Mote OAuth credentials for the selected origin only. It does not:

- Revoke Cloudflare grants or disable Service Tokens.
- Remove static-token configuration or log out Codex.
- Delete published documents.

`codex mcp logout <server>` targets that Codex MCP login, not the Codex account.
An administrator must separately revoke the appropriate Access user/application sessions or disable the machine token.
Application-wide revocation affects other users of that application. Verify its scope before acting. Already published capability URLs remain readable.

Each publication creates a new immutable document. Do not automatically retry timeouts, 5xx responses or uncertain outcomes: the write may have succeeded.
If no URL was returned, preserve the error, request time and instance address for the administrator to investigate.
Keep credentials and private document URLs out of shared logs. Follow [Unknown publication outcome](cli.md#unknown-publication-outcome) before publishing again.

## Migration notes

<a id="moving-to-motepub"></a>

- [Moving to mote.pub](migrations.md#moving-to-motepub) — for clients still targeting the former default domain.

<a id="migrate-an-existing-instance"></a>

- [Migrate an existing instance to Access](migrations.md#migrate-an-existing-instance-to-access) — publisher migration, validation and rollback.
