# Highlights and definition lists

Use highlights to draw attention to a phrase, and definition lists to explain terms.
Both remain readable without JavaScript and when printed.

## 1. Highlight a conclusion

This is an ==important conclusion==, with **strong emphasis** kept separate.
中文也能直接使用：这是==需要注意的结论==，其余内容保持正常。

Highlights can include ==**bold text**, `inline code` and [a link](https://example.com)==.

Literal forms stay visible: `==code==`, \==escaped\==, == leading space== and ==unclosed.

## 2. Explain terms

Capability URL
: A link that grants access to a document to anyone who has it.
: Keep it private when the document is private.

Immutable publication
: The published Markdown stays unchanged. Publish again to create a new document.

## 3. Rich definitions

A document bundle

: The source Markdown and its referenced images.

    - ==Original source== stays intact.
    - Identical image assets are deduplicated.

    ![Mote logo](../assets/icon.png){ width="96" }
    /// caption
    A visible caption inside a definition.
    ///

    ```md title="Literal example"
    Term
    : ![Not an upload](code-example.png)
    ==This is code==
    ```

    Inline math remains math: $a == b$.

    $$
    x = y + 1
    $$

## 4. Inside existing components

!!! note "Reading terms"

    Source
    : The ==original Markdown== you publish.

=== "Author"

    Asset
    : An image bundled with the document.

=== "Reader"

    Viewer
    : A page that presents the source and its images.

> Definition in a quote
> : Still uses ordinary quote styling.

- Definition in a list
  : Uses ordinary list indentation.

A definition can contain a footnote reference.[^term]

[^term]:
    Footnote term
    : A definition in an existing footnote.

## 5. Fallback and nesting

: This colon has no preceding term after the heading.

Nested vocabulary
: A definition can contain another definition list.

    Inner term
    : Its explanation stays indented.

Code and mathematical source do not interpret the new syntax:

```md
==No highlight inside a fence==
Term
: ![Not an upload](code-example.png)
```

The supported syntax is documented in the [Markdown guide](../markdown.md#highlights-and-definition-lists).
