# Publish your first document

[简体中文](zh-CN/quick-start.md)

This tutorial takes you from a local Markdown file to a browser-readable page using the CLI. You need Node.js 20 or newer, npm, an interactive terminal and a browser on the same computer. You do not need a repository checkout.

## 1. Choose an instance

You need permission to publish to a Mote instance:

- **Default instance:** `https://mote.pub` permits only approved publishers. Confirm access with the instance administrator before continuing; installing the CLI does not grant access.
- **Your own instance:** ask its administrator for the API origin and authentication mode, or follow [self-hosting](self-hosting.md) to deploy one.

The steps below use browser login on an Access-enabled instance. For a token-mode instance, use the [token publishing instructions](self-hosting.md#8-configure-your-clients). For unattended jobs, use [machine publishing](authentication.md#machine-publishing).

## 2. Install the CLI

Run in your terminal:

```bash
npm install -g mote-cli
mote --version
```

The second command prints the installed CLI version. If `mote` is not found, check that npm's global executable directory is on your `PATH`, then reopen the terminal.

## 3. Create a document

In a working folder of your choice, create a file named `hello.md` with a text editor:

```markdown
# Hello, Mote

This is my first published document.

- Written in **Markdown**
- Readable in a browser
```

Save it as UTF-8. Run the remaining commands from the folder containing `hello.md`. Use sample content you are comfortable sharing: anyone with the resulting URL can read the page without logging in.

## 4. Sign in

For the default instance:

```bash
mote login --api https://mote.pub --auth-mode oauth
```

For your own Access-enabled instance, replace the example origin:

```bash
mote login --api https://mote.example.com --auth-mode oauth
```

Choose one command for your instance. Use the origin alone, without `/api/mcp` or `/api/v1/publish`.

Login displays an authorization URL. Press `o` to open it, or open the displayed URL manually on the same computer. Complete the browser authorization and wait for the terminal to confirm login. Credentials are saved in the system credential store by default; see [credential storage](authentication.md#credential-storage-and-refresh) if it is unavailable.

Successful login remembers the instance for publishing. If login reports conflicting environment or configuration settings, resolve them using [configuration selection](authentication.md#configuration-selection) before continuing.

Check the saved login against the server:

```bash
mote auth status
```

Confirm that the reported API is your chosen instance and authentication succeeds.

## 5. Publish

From the folder containing `hello.md`, run:

```bash
mote hello.md
```

On success, the CLI prints `Published:` followed by your document URL. The hostname belongs to the instance you selected, and the last path segment is a newly generated document ID.

## 6. Open the page

Open the returned URL in a browser. You should see the “Hello, Mote” heading and the two list items. The page can also be read in a private browser window without a publishing login.

You have published your first document. Editing the local file does not update this page: publishing again creates a new URL. Availability depends on the instance and its storage continuing to operate.

## If a step fails

| Symptom                                                     | Next step                                                                                                                                                                    |
| ----------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Browser authorization is denied                             | Confirm that the instance administrator has allowed your identity. See [authentication](authentication.md#user-login-cli-and-local-stdio).                                   |
| Login cannot open the browser or save credentials           | Use the displayed link on the same computer; check [login and credential troubleshooting](cli.md#troubleshooting).                                                           |
| Status or publication selects another instance or auth mode | Check [configuration selection](authentication.md#configuration-selection), including inherited environment variables.                                                       |
| `hello.md` is not found                                     | Run from the folder where you saved it, or pass its full path.                                                                                                               |
| Session expired or login is required                        | Run the login command again with your instance's explicit `--api`.                                                                                                           |
| A publication times out or returns a server error           | Resolve the outcome before publishing again; the first write may already have succeeded and retries create new documents. See [CLI troubleshooting](cli.md#troubleshooting). |

## Next steps

- Add local images or automate publishing with the [CLI reference](cli.md).
- Check supported syntax in [Markdown compatibility](markdown.md).
- Publish from an agent with [MCP](mcp.md) or the [Skill](skill.md).
- Browse the [documentation index](README.md).
