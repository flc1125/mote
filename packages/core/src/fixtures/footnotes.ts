/** Synthetic sources shared by scanner and renderer regressions. */
export const FOOTNOTE_CASES = [
  {
    name: 'multiple paragraphs and repeated references',
    source: 'A[^note] and again[^note].\n\n[^note]: Note.\n\n    ![image](foot.png)\n',
    images: ['foot.png'],
  },
  {
    name: 'reference images and HTML picture in a footnote',
    source:
      'A[^n]\n\n[^n]: ![one][asset]\n\n    <picture><source srcset="dark.png 2x"><img src="light.png"></picture>\n\n[asset]: foot.png\n',
    images: ['foot.png', 'dark.png', 'light.png'],
  },
  {
    name: 'unreferenced definitions are omitted',
    source: 'Body.\n\n[^unused]: ![hidden](missing.png)\n\n    ![also hidden](missing-too.png)\n',
    images: [],
  },
  {
    name: 'undefined references remain text',
    source: 'Body[^missing].\n\n![visible](body.png)',
    images: ['body.png'],
  },
  {
    name: 'self references terminate',
    source: 'A[^n]\n\n[^n]: Self[^n].\n\n    ![image](foot.png)\n',
    images: ['foot.png'],
  },
  {
    name: 'mutually referencing footnotes terminate',
    source: 'A[^a]\n\n[^a]: B[^b]. ![a](a.png)\n\n[^b]: A[^a]. ![b](b.png)\n',
    images: ['a.png', 'b.png'],
  },
  {
    name: 'inline footnotes contain images',
    source: 'Inline^[![image](inline.png)].',
    images: ['inline.png'],
  },
  {
    name: 'fenced and indented code in footnotes remains literal',
    source:
      'A[^n]\n\n[^n]: Note.\n\n    ```md\n    ![hidden](missing-fence.png)\n    <img src="missing-html.png">\n    ```\n\n        ![hidden](missing-indent.png)\n\n    ![visible](foot.png)\n',
    images: ['foot.png'],
  },
  {
    name: 'inline code and mathematical source remains literal',
    source:
      'A[^n]\n\n[^n]: `![hidden](missing-code.png)` and $\\text{![hidden](missing-math.png)}$.\n\n    \\[\n    \\text{![hidden](missing-block.png)}\n    \\]\n\n    ![visible](foot.png)\n',
    images: ['foot.png'],
  },
  {
    name: 'asset order follows the rendered body then footnotes',
    source:
      'A[^n]. ![body](body.png)\n\n[^n]: ![shared](body.png)\n\n    ![foot](foot.png)\n\n![later](later.png)\n',
    images: ['body.png', 'later.png', 'foot.png'],
  },
] as const;
