# Mote CLI Reference

The `mote` CLI publishes a local Markdown file to a Mote instance and prints its URL.

```bash
mote <markdown-file>
# equivalent to
mote publish <markdown-file>
```

## Installation

**From source** (requires Node.js ≥ 20 and pnpm):

```bash
git clone https://github.com/flc1125/mote.git
cd mote
pnpm install
pnpm --filter @mote/cli build
cd apps/cli && npm install -g .
```

**From npm** — coming with the v0.1.0 release (`npm install -g …`).

Verify:

```bash
mote --help
```

## Configuration

Resolution order (highest priority first):

```text
CLI arguments  >  environment variables  >  config file  >  defaults
```

| Setting | CLI argument      | Environment variable | Config file key | Default               |
| ------- | ----------------- | -------------------- | --------------- | --------------------- |
| API URL | `--api <url>`     | `MOTE_API_URL`       | `apiUrl`        | `https://mote.flc.io` |
| Token   | `--token <token>` | `MOTE_TOKEN`         | `token`         | —                     |

Config file location: `$XDG_CONFIG_HOME/mote/config.json` (usually `~/.config/mote/config.json`):

```json
{
  "apiUrl": "https://mote.flc.io",
  "token": "your-token"
}
```

Recommended permissions: `chmod 600 ~/.config/mote/config.json`. The token is never written to logs, stdout, or error messages.

## Options

| Option          | Description                                                      |
| --------------- | ---------------------------------------------------------------- |
| `--json`        | Print only `{"id","url"}` on stdout — for agents, CI and scripts |
| `--token`       | Publish token (overrides `MOTE_TOKEN`)                           |
| `--api`         | API base URL (overrides `MOTE_API_URL`)                          |
| `--no-assets`   | Publish Markdown only; skip local images                         |
| `--verbose`     | Verbose progress on stderr                                       |
| `-h, --help`    | Show help                                                        |
| `-v, --version` | Show version                                                     |

Human output:

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

## Troubleshooting

| Error                             | Cause / fix                                                           |
| --------------------------------- | --------------------------------------------------------------------- |
| `no publish token configured`     | Set `MOTE_TOKEN`, pass `--token`, or add `"token"` to the config file |
| `asset not found: <path>`         | A referenced image does not exist; fix the relative path              |
| `unsupported image type`          | SVG or non-image referenced; convert to png/webp                      |
| `markdown is … bytes, limit is …` | Markdown over 2 MB — split the document                               |
| `UNAUTHORIZED`                    | Wrong or expired token                                                |
| `BUNDLE_TOO_LARGE`                | Bundle exceeds a size limit (see README limits)                       |
