# Self-hosting Mote

[简体中文](zh-CN/self-hosting.md)

Mote runs on Cloudflare: two Workers + one R2 bucket, no database or server to manage. This guide takes you from zero to your own instance at `https://<your-domain>`. Small workloads may fit the free tier; see [costs](#costs) and rendering capacity below.

Steps 1–8 deploy an instance with **token** authentication. For browser login or Service Tokens, follow the [Access section](#access-enabled-deployments) and [authentication guide](authentication.md). Installing an npm package does not deploy Workers; repository workflows are described under [deployment automation](#deployment-automation).

> Commands below use `<your-domain>` as a placeholder — replace it with your own (sub)domain, e.g. `mote.example.com`.

## Prerequisites

- A [Cloudflare account](https://dash.cloudflare.com/sign-up) with a domain added as a **zone** (nameservers pointing to Cloudflare)
- Node.js 24 (the CI development baseline) and pnpm 11.23.0, pinned in the root `package.json`
- A checkout of this repository:

```bash
git clone https://github.com/flc1125/mote.git
cd mote
pnpm install --frozen-lockfile
```

The steps below use the **top-level configuration**, selected explicitly by `--env=""`; the repository's `access-test` environment belongs to a separate project-specific deployment.

## 1. Configure your deployment targets

Choose your Worker names, hostname and R2 bucket before creating resources or setting secrets. The examples use `mote-api`, `mote-viewer` and `mote-documents` in your own Cloudflare account; substitute your chosen names consistently if those names are already in use.

In `apps/viewer/wrangler.toml`, edit the existing top-level fields and R2 binding, keeping `[cache]` enabled:

```toml
name = "mote-viewer"
routes = [{ pattern = "<your-domain>/*", zone_name = "<your-zone>" }]

[[r2_buckets]]
binding = "DOCUMENTS"
bucket_name = "mote-documents"
```

In `apps/api/wrangler.toml`, edit the existing top-level fields, `[vars]` and R2 binding. Replace `MOTE_AUTH_MODE` with `token` and remove `MOTE_ACCESS_ISSUER`, `MOTE_ACCESS_AUD` and `MOTE_ACCESS_HOSTNAME`, which belong to the project's Access deployment:

```toml
name = "mote-api"
routes = [{ pattern = "<your-domain>/api/*", zone_name = "<your-zone>" }]

[vars]
VIEWER_BASE_URL = "https://<your-domain>"
MOTE_AUTH_MODE = "token"

[[r2_buckets]]
binding = "DOCUMENTS"
bucket_name = "mote-documents"
```

These are excerpts to replace existing values, not complete files or extra TOML tables to append. Keep each file's `main` and compatibility date. Both Workers must bind the same bucket.

`<your-zone>` is the DNS zone name (for example `example.com`). The API owns `/api/*`; the Viewer owns the remaining paths. Both use Routes with proxied DNS, and the most specific route wins. Cloudflare Routes take precedence over Custom Domains on the same hostname.

**Fork build checks:** `pnpm build` validates this project's exact production and test configuration. To use that command and CI in your fork, adapt `scripts/workers/targets.json` for your resource names, hostname, zone and account; adapt `scripts/workers/config.mjs` for your chosen auth vars and environments as well. Its API expectation is currently fixed to Access mode, so changing only Wrangler's domain or token mode will fail the check. Step 5's app-specific Wrangler dry-runs can validate bundling independently of those project allowlists.

Token-only staging may use `workers_dev = true` without routes, with the API's `VIEWER_BASE_URL` pointing at the Viewer hostname. Access mode requires a protected hostname with workers.dev and preview URLs disabled.

## 2. Log in to Cloudflare

```bash
pnpm --filter @mote/api exec wrangler login
```

This opens a browser to authorize Wrangler. Select the account containing your DNS zone and intended Worker resources; configure `account_id` in both top-level Worker configs if you need to disambiguate accounts.

## 3. Create the R2 bucket

```bash
pnpm --filter @mote/api exec wrangler r2 bucket create mote-documents
```

## 4. Generate and store your publish token

```bash
openssl rand -hex 32
```

Save the output somewhere safe — it becomes your `MOTE_TOKEN` for the CLI/MCP. Then set it as the API Worker's secret (paste it when prompted):

```bash
pnpm --filter @mote/api exec wrangler secret put MOTE_TOKEN --env=""
```

The secret command uses the API Worker name and account selected above. If Wrangler prompts to create that Worker, confirm the selected name. Rotate by setting a replacement and updating the clients that use it; keep the value out of Git and shared logs.

## 5. Deploy

First check that each configured Worker bundles successfully. These commands do not upload a Worker or validate live DNS/Access settings:

```bash
pnpm --filter @mote/api exec wrangler deploy --dry-run --env=""
pnpm --filter @mote/viewer exec wrangler deploy --dry-run --env=""
```

Then deploy the selected top-level configuration:

```bash
pnpm --filter @mote/api exec wrangler deploy --env=""
pnpm --filter @mote/viewer exec wrangler deploy --env=""
```

## 6. Add the DNS record

Worker routes need a proxied DNS record for the hostname. In the Cloudflare dashboard: your zone → **DNS → Records → Add record**:

- Type: `AAAA`
- Name: your subdomain (e.g. `mote`)
- IPv6 address: `100::`
- Proxy status: **Proxied**

(The record is a placeholder — requests are intercepted by the Workers routes before any origin.)

## 7. Verify

```bash
curl https://<your-domain>/health          # viewer: {"status":"ok"}
curl https://<your-domain>/api/health      # API:    {"status":"ok"}
```

From the repository root, publish a small synthetic document using the token you saved in step 4:

```bash
export MOTE_TOKEN="<your-token>"
export MOTE_API_URL="https://<your-domain>"
export MOTE_AUTH_MODE="token"
pnpm --filter @mote/cli build
node apps/cli/dist/cli.js docs/examples/weekly-report.md
```

Open the printed URL and confirm the report and its remote image render. To check local-image uploads, publish `docs/examples/markdown-compatibility.md` and check that both logo references resolve to one uploaded asset. Each publish creates a new document.

Check document headers with `curl -I <published-url>`: browser `Cache-Control` should specify `max-age=300`, and the Cloudflare CDN policy should specify `max-age=31536000`. Repeated requests reaching the same edge can show `cf-cache-status: HIT`; the first miss after a new Worker version is expected. A dry-run alone does not verify this deployed cache behavior.

## 8. Configure your clients

CLI (`~/.config/mote/config.json`):

```json
{
  "apiUrl": "https://<your-domain>",
  "authMode": "token",
  "token": "<your-token>"
}
```

Remote MCP (`publish_markdown` tool):

```text
URL:   https://<your-domain>/api/mcp
Header: Authorization: Bearer <your-token>
```

## Costs

Small workloads may fit the free tier. Plan against your account's current Worker request/CPU limits and R2 storage/operation allowances; domain registration and usage beyond included quotas may add costs. Cache hits are served before the Viewer executes, while misses incur Worker work and R2 reads. Immutable publishing continually adds stored bundles, and remote image availability is outside your instance's control.

Formulas and diagram layout have [rendering budgets](markdown.md#rendering-budgets), but those budgets do not guarantee that every supported document fits a free plan's CPU allowance. Check representative cache misses when choosing capacity.

<a id="access-enabled-deployments-unreleased"></a>

## Access-enabled deployments

Use a separate hostname, Worker pair and R2 bucket for validation. The repository's `access-test` environment is project-specific: replace its account, routes, bucket and identity values rather than deploying it unchanged.

Its configured targets are `mote-test-api`, `mote-test-viewer`, `mote-test-documents` and `mote-test.flc.io`, with the independent `mote-test` Access application. The logical environment name is `access-test`. `apps/auth-probe` uses fake account/identity values and no routes for local regression tests and dry-run builds only; never point it at live resources.

1. Configure Zero Trust with your identity provider and an explicit publisher Allow policy. Protect only `<your-domain>/api/mcp`, `<your-domain>/api/v1/publish` and `<your-domain>/api/auth/*` in the same Access application. Keep document/asset URLs, health checks and required public OAuth metadata reachable without login; do not gate the entire Viewer hostname.
2. Enable Managed OAuth and the localhost/loopback callback support required by your actual clients. Do not allow arbitrary public callback wildcards. Discover the exact MCP resource and authorization issuer; use a pre-registered client and exact callback for the tested Codex flow in [the MCP guide](mcp.md#codex).
3. Choose token/grant durations for your risk level. Set `grant.access_token_lifetime` and `grant.session_duration` under `oauth_configuration`, not the ordinary application session duration. For API updates, GET the current application, preserve other fields, PUT the intended change, then independently GET and compare the exact durations. Never PUT only a partial configuration. See [Managed OAuth](https://developers.cloudflare.com/cloudflare-one/access-controls/applications/http-apps/managed-oauth/).
4. Add a separate Service Auth policy only if machine publishing is needed; select specific tokens and restrict the policy to this application. See [machine publishing and rotation](authentication.md#machine-publishing).
5. In your API Worker's configuration, preserve routes/bindings and replace the existing auth vars with the following example. `MOTE_ACCESS_HOSTNAME` is the protected API host, not a different Viewer host. Never use the test application's AUD for production.

```toml
workers_dev = false
preview_urls = false

[vars]
VIEWER_BASE_URL = "https://mote.example.com"
MOTE_AUTH_MODE = "cloudflare-access"
MOTE_ACCESS_ISSUER = "https://your-team.cloudflareaccess.com"
MOTE_ACCESS_AUD = "<your-application-aud>"
MOTE_ACCESS_HOSTNAME = "mote.example.com"
```

6. Review the exact environment, Worker names, route precedence and bucket before manually deploying the selected configuration. Do not run the default production deploy command for a test environment. Require separate approval before changing an existing production deployment.
7. Follow [CLI login/status/publish/logout](authentication.md#user-login-cli-and-local-stdio) and [Codex](mcp.md#codex). Verify anonymous publishing fails, metadata resource equals the full `/api/mcp` URL, valid user/service publishing works, invalid credentials fail, and published URLs/assets remain anonymously readable. Verify alternate Worker hosts cannot publish. Record versions and outcomes without secrets.

Access issues opaque client tokens; Mote validates the signed identity assertion supplied by Access rather than decoding that token. The API requires HTTPS and its configured host, validates the assertion signature/issuer/AUD/time/type/identity, and fails closed. It does not trust an email header, Cookie, client ID or management API token as identity. See [security](security.md#5-发布鉴权与凭据管理).

For an existing token deployment, use the ordered [migration and rollback steps](migrations.md#migrate-an-existing-instance-to-access). OAuth approval does not grant permission to deploy or change production.

## Deployment automation

Production `mote-api` and `mote-viewer` deploy independently through Cloudflare Workers Builds whenever `main` is pushed. GitHub Actions runs CI on PRs and `main`; stable `vX.Y.Z` tags publish only the CLI package and GitHub Release. There is no GitHub manual Worker deployment workflow.

Connect each production Worker to your repository only after its resources, routes and authentication have been reviewed. Use the [Workers Builds settings](deployment.md#expected-workers-builds-settings): workspace root `/`, an empty build command, and the app-specific filtered Wrangler deploy command. Configure build credentials and build-only variables in Cloudflare; runtime secrets remain separate. The commands in step 5 remain available for initial self-hosting and explicitly approved manual work.

Adapt the fork build checks described in step 1 before enabling CI. The CLI release code also pins `flc1125/mote` and `mote-cli`; review `scripts/release/` and npm Trusted Publishing before enabling package releases in a fork.

Both Workers must converge on the same expected source SHA. Use backward-compatible changes while they roll out independently, and follow [deployment operations](deployment.md) for verification, failures, retries and rollback. Workers Builds does not provision your DNS, R2 or Access policies. This production setup does not automatically deploy the separate `access-test` environment.

## Next steps

- [Deployment operations](deployment.md) — failed runs, reruns and manual recovery
- [CLI reference](cli.md) — options, config, scripting
- [MCP guide](mcp.md) — remote and stdio integrations
- [Architecture](architecture.md) — how the pieces fit
