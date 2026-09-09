# Markdown compatibility

Mote uses CommonMark-style parsing with tables, strikethrough, automatic links,
footnotes and read-only task lists. Presentational HTML passes through an allowlist;
scripts, event handlers and arbitrary styles are not supported.

## Chinese emphasis

Mote accepts a limited extension to double-asterisk emphasis: punctuation next to
Chinese, Japanese or Korean text, and East Asian punctuation or quotation marks,
may open or close emphasis without added spaces. For example:

```markdown
**说明：**后续正文
**阅读提示：**English text
前文**“重点”**后文
**说明:**中文正文
***重点：***正文
```

This deliberately extends CommonMark's punctuation boundary rules. Native delimiter
pairing still handles nesting and unmatched markers. Escapes, code, link destinations
and HTML attributes retain their original interpretation. Single-asterisk emphasis,
underscores and ASCII-only cases such as `**English:**Next` retain standard behavior.
Ordinary line breaks remain soft breaks; use two trailing spaces or a backslash for
an explicit hard break.

Task-list labels preserve parsed emphasis, links and inline code exactly once.
Checkboxes remain read-only, and their labels do not introduce random IDs.

## Heading links

Ordinary heading IDs retain their previous spelling. Repeated headings and headings
with numeric suffixes receive globally unique IDs. A heading containing only
punctuation or emoji uses `section` (with a numeric suffix when necessary). IDs used
by the contents drawer, footnotes and task checkboxes are reserved.

The contents drawer links to these allocated IDs. Links to previously ambiguous or
empty IDs may change; normal existing heading links are preserved.

## Examples and regression coverage

See [the compatibility sample](examples/markdown-compatibility.md) for formatting,
list, table, HTML and heading combinations. Renderer tests include explicit expected
outputs for the extension, comparisons with the standard parser for protected syntax,
and page-level checks that generated fragment links resolve uniquely.

## Known limitations

- GitHub Alerts, syntax highlighting, front matter metadata, math and Mermaid are
  not yet interpreted as dedicated features. Fenced code remains readable as text.
- Markdown inside an HTML block still follows CommonMark blank-line boundaries.
- Mixed Markdown/HTML images with Unicode or spaces in local paths need a separate
  asset-path compatibility fix across the CLI and renderer. A known-failure test
  records the expected mapping; this change does not claim to resolve that case.
- Arbitrary HTML/CSS, executable embeds and editor-specific features such as MDX or
  Dataview are outside the current supported format.
