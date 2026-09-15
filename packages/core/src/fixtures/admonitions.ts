/** Shared visible-image expectations for both publishing and rendering. */
export const ADMONITION_CASES = [
  {
    name: 'custom title and Markdown image',
    source: '!!! warning "Back up first"\n\n    ![backup](backup.png)\n',
    images: ['backup.png'],
    containers: 1,
  },
  {
    name: 'closed, open and nested bodies all contain publishable images',
    source:
      '??? note\n\n    ![closed](closed.png)\n\n    ???+ tip\n\n        ![nested](nested.png)\n',
    images: ['closed.png', 'nested.png'],
    containers: 2,
  },
  {
    name: 'global reference definitions',
    source:
      '!!! note\n\n    ![asset][outside]\n\n    [inside]: inner.png\n\n![external][inside]\n\n[outside]: outer.png\n',
    images: ['outer.png', 'inner.png'],
    containers: 1,
  },
  {
    name: 'HTML picture and inline image',
    source:
      '!!! example\n\n    <picture><source srcset="dark.png 2x"><img src="light.png"></picture>\n\n    Inline <img src="inline.png">\n',
    images: ['dark.png', 'light.png', 'inline.png'],
    containers: 1,
  },
  {
    name: 'code and math are protected inside containers',
    source:
      '??? note\n\n    ```md\n    ![fake](fence.png)\n    !!! tip\n    ```\n\n        ![fake](indented.png)\n\n    $\\text{![fake](math-inline.png)}$\n\n    \\[\n    \\text{![fake](math-block.png)}\n    \\]\n\n    ![real](real.png)\n',
    images: ['real.png'],
    containers: 1,
  },
  {
    name: 'footnotes within a container retain image scanning',
    source: '!!! note\n\n    Note[^n].\n\n    [^n]: Footnote.\n\n        ![foot](foot.png)\n',
    images: ['foot.png'],
    containers: 1,
  },
  {
    name: 'unknown type falls back without consuming indented images',
    source: '!!! unknown\n\n    ![fake](unknown.png)\n\n![outside](outside.png)\n',
    images: ['outside.png'],
    containers: 0,
  },
  {
    name: 'missing blank line follows ordinary paragraph image semantics',
    source: '!!! note\n    ![paragraph](paragraph.png)\n',
    images: ['paragraph.png'],
    containers: 0,
  },
  {
    name: 'quotes and lists do not enable containers',
    source:
      '> !!! note\n>\n>     ![fake](quote.png)\n\n- Item\n\n  !!! note\n\n      ![fake](list.png)\n',
    images: [],
    containers: 0,
  },
  {
    name: 'a container marker in a footnote remains ordinary text',
    source:
      'Note[^n].\n\n[^n]: Footnote.\n\n    !!! note\n\n        ![fake](foot-code.png)\n\n    ![real](foot.png)\n',
    images: ['foot.png'],
    containers: 0,
  },
  {
    name: 'escaped and code-contained markers remain literal',
    source:
      '\\!!! note\n\n    ![fake](escaped.png)\n\n```md\n!!! note\n\n    ![fake](code.png)\n```\n',
    images: [],
    containers: 0,
  },
] as const;
