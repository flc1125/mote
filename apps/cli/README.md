# mote-cli

> **Mote = Markdown in, URL out.** Publish Markdown as immutable, unguessable, browser-readable web pages.

## Install

```bash
npm install -g mote-cli
```

## Usage

```bash
export MOTE_TOKEN="your-token"

mote README.md
```

```text
Published:

https://mote.flc.io/7Vk3mQ9x2NFaP4Ls
```

Local images referenced by your Markdown are uploaded automatically (deduplicated, opaque URLs). Use `--json` for machine-readable output, `--no-assets` to skip images, `--help` for everything else.

Full documentation: [github.com/flc1125/mote](https://github.com/flc1125/mote) — [CLI reference](https://github.com/flc1125/mote/blob/main/docs/cli.md) · [Self-hosting](https://github.com/flc1125/mote/blob/main/docs/self-hosting.md) · [MCP](https://github.com/flc1125/mote/blob/main/docs/mcp.md)

## License

MIT
