# Abbreviations and footnote previews

Explain terms in place and open a footnote without losing your reading position.
The full notes remain at the end of the page, including when JavaScript is unavailable.

## 1. Explain abbreviations

HTML, API and R2 can carry short explanations. Hover the dotted text for the native hint.
Case and word boundaries matter: html, APIs and 中文API stay plain; （API） is explained.

中文术语也可以：对象存储。相连的“对象存储服务”不会拆开匹配。

**API** and ==R2== keep their formatting. Code `API`, math $API$, and [API in a link](https://example.com) keep their own meaning.

*[HTML]: HyperText Markup Language
*[API]: Application Programming Interface
*[R2]: Cloudflare object storage
*[对象存储]: 以对象为单位保存数据的存储方式
*[API]: This later definition does not replace the first.

## 2. Read a note in place

Open this short note.[^short] The same note can be referenced again.[^short]

This note contains an image, a link and a code sample.[^rich]

This longer note has several paragraphs and a definition list.[^long]

[^short]: An API connects software components. **Bold text**, ==highlights== and `inline code` remain readable.

[^rich]: A document bundles its source and assets. See the [Markdown guide](../markdown.md).

    ![Mote logo](../assets/icon.png){ width="96" }
    /// caption
    A bundled image inside a footnote.
    ///

    ```sh title="Command" linenums="1"
    echo "API remains literal in code"
    ```

[^long]:
    The preview keeps your current reading position. You can close it with Escape, the close button, or a click outside.

    Use **Go to footnote** to read the original note at the end of the document. The original return links take you back to each reference.

    Keyboard readers can focus the scrollable content and follow its links. The preview is not a modal dialog, so focus may leave it.

    Long content stays inside a bounded scroll area instead of covering the entire page. Resizing or scrolling keeps the preview near its reference.

    Capability URL
    : A link that grants access to a document.

    Source document
    : The original Markdown stays unchanged.

    A preview only shows already-rendered content. Definitions, links and images use the same published assets as the original note.

    If a note exceeds the preview budget or needs a complex renderer, the reference goes directly to the complete note instead.

## 3. Inside existing components

??? note "A note inside a disclosure"

    An HTML document can include footnotes.[^short]

=== "Author"

    Define the API term once and write Markdown as usual.

=== "Reader"

    Open a note here, then use its return link to come back to this panel.[^rich]

## 4. Complete content fallback

A formula-containing note uses the original footnote link.[^formula]

[^formula]: A mathematical definition: $x^2 + y^2 = z^2$.

Unmatched or escaped definition markers remain ordinary text:

\*[HTML]: This is an example, not a second definition.

```markdown
*[API]: A literal example
API
![Not an upload](not-an-asset.png)
```
