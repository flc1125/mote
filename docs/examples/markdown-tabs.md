# Content tabs

Use tabs for alternative instructions. Each group switches independently.
Use the contents drawer to visit headings inside inactive panels.

## 1. Choose a package manager

=== "npm"

    Install the CLI with npm. You can also [jump to the verification steps](#verify-the-installation).

    ```sh title="Terminal"
    npm install -g mote-cli
    ```

=== "pnpm"

    Install the CLI with pnpm:

    ```sh title="Terminal"
    pnpm add -g mote-cli
    ```

    ??? tip "Verify your setup"

        ### Verify the installation

        ```sh
        mote --version
        ```

## 2. Independent groups and rich content

=== "Images and notes"

    ![Mote icon](../assets/favicon-32.png)

    !!! note "Included with your document"

        Images in every panel are bundled, including panels that start hidden.
        This icon is the same asset: ![Mote icon again](../assets/favicon-32.png).

    A footnote can link back into this panel.[^tabs]

=== "Tables and mathematics"

    | Option | Meaning |
    | --- | --- |
    | `--no-assets` | Skip local image uploads |
    | `--help` | Show command help |

    Inline math: $E = mc^2$.

    ```mermaid
    graph LR
    A[Markdown] --> B[Published page]
    ```

## 3. Tabs inside a disclosure

??? example "Compare output formats"

    === "Text"

        Plain text stays easy to select and copy.

    === "JSON"

        ```json title="result.json" linenums="1" hl_lines="2"
        {
          "ready": true
        }
        ```

## 4. Single and repeated labels

=== "One readable section"

    A single label remains a static section with no switching controls.

This paragraph starts a new group:

=== "Same label"

    The first panel has its own link.

=== "Same label"

    The second panel has a different link, even though the label is identical.

## 5. Long labels and narrow screens

=== "A longer label that wraps when the available reading width is limited"

    ```text
    abcdefghijklmnopqrstuvwxyz0123456789 / abcdefghijklmnopqrstuvwxyz0123456789 / abcdefghijklmnopqrstuvwxyz0123456789 / abcdefghijklmnopqrstuvwxyz0123456789
    ```

=== "另一个较长的中文标签：用于检查窄屏下的换行、选中状态与键盘焦点"

    Labels remain readable. The strip scrolls when it cannot fit all options.

## 6. Ordinary Markdown fallback

An empty label stays ordinary Markdown. The image below is a code example and must not be uploaded:

=== ""

    ![Only an example](must-not-upload.png)

=== "Nesting boundary"

    !!! note "A tab group cannot contain another tab group"

        === "Nested example"

            ![Only an example](also-must-not-upload.png)

[^tabs]: Follow the return link to reveal the referring panel.
