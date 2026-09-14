# mote-cli

> **Mote = Markdown in, URL out.** Publish Markdown as immutable, unguessable, browser-readable web pages.

## Install

```bash
npm install -g mote-cli
```

## Usage

Log in to an Access-enabled instance and publish:

```bash
mote login
mote README.md
```

The default instance is `https://mote.pub`, which permits only approved publishers. For your own instance, use `mote login --api https://mote.example.com --auth-mode oauth`. Login remembers the instance; explicit environment/config overrides still take precedence when publishing. `mote auth login` is an alias for `mote login`; use `mote auth status` to check credentials and `mote auth logout` to remove local OAuth credentials. The [authentication guide](https://github.com/flc1125/mote/blob/main/docs/authentication.md) covers configuration selection, secure storage and machine mode. Installing this package does not deploy Workers.

For your own static-token instance, explicitly select token mode:

```bash
export MOTE_TOKEN="your-token"
export MOTE_API_URL="https://mote.example.com" # your own token-mode instance
export MOTE_AUTH_MODE="token"

mote README.md
```

```text
Published:

https://mote.example.com/7Vk3mQ9x2NFaP4Ls
```

Local images referenced by Markdown or supported HTML are uploaded automatically (deduplicated, opaque URLs). In a terminal, publishing shows scanning progress and a content summary on stderr before uploading. Use `--verbose` to include progress in redirected logs, `--json` for machine-readable output without progress, `--no-assets` to skip local-image uploads while retaining their references, and `--help` for everything else.

Every publish creates a new URL. Stored Markdown and uploaded assets are immutable; presentation can change with Viewer updates, and remote images remain dependent on their hosts. Anyone with the URL can read the document. Availability depends on the instance and its storage remaining operational.

Full documentation: [github.com/flc1125/mote](https://github.com/flc1125/mote) — [CLI reference](https://github.com/flc1125/mote/blob/main/docs/cli.md) · [Self-hosting](https://github.com/flc1125/mote/blob/main/docs/self-hosting.md) · [MCP](https://github.com/flc1125/mote/blob/main/docs/mcp.md)

## License

MIT
