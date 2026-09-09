# mote-cli

> **Mote = Markdown in, URL out.** Publish Markdown as immutable, unguessable, browser-readable web pages.

## Install

```bash
npm install -g mote-cli
```

## Usage

With v0.2.0, log in to an Access-enabled instance and publish:

```bash
mote login
mote README.md
```

The default instance is `https://mote.pub`, which permits only approved publishers. For your own instance, use `mote login --api https://mote.example.com --auth-mode oauth`. Login remembers the instance; explicit environment/config overrides still take precedence. The original `mote auth login`, status and logout commands remain supported. See the [authentication guide](https://github.com/flc1125/mote/blob/main/docs/authentication.md) for secure storage, machine mode and migration limits. Installing or publishing this package does not deploy Workers.

For your own static-token instance (also supported by v0.1.1), explicitly select token mode:

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

Local images referenced by your Markdown are uploaded automatically (deduplicated, opaque URLs). Use `--json` for machine-readable output, `--no-assets` to skip images, `--help` for everything else.

Full documentation: [github.com/flc1125/mote](https://github.com/flc1125/mote) — [CLI reference](https://github.com/flc1125/mote/blob/main/docs/cli.md) · [Self-hosting](https://github.com/flc1125/mote/blob/main/docs/self-hosting.md) · [MCP](https://github.com/flc1125/mote/blob/main/docs/mcp.md)

## License

MIT
