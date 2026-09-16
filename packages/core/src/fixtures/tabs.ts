const indent = (source: string) =>
  source
    .split('\n')
    .map((line) => '    ' + line)
    .join('\n');
const tab = (body: string) => '=== "Option"\n\n' + indent(body) + '\n\n';

/** Shared scanner/renderer inputs: fallback code images must never become assets. */
export const TAB_CASES = [
  {
    name: 'all panels including inactive images',
    source: tab('![a](a.png)') + tab('![b](b.png)'),
    images: ['a.png', 'b.png'],
  },
  {
    name: 'references across panels',
    source: tab('![a][r]') + tab('[r]: a.png'),
    images: ['a.png'],
  },
  {
    name: 'code and math stay literal',
    source: tab('![real](a.png)\n\n```md\n![fake](code.png)\n```\n\n$$\n![fake](math.png)\n$$'),
    images: ['a.png'],
  },
  {
    name: 'nested admonitions inside tabs',
    source: tab('!!! note\n\n    ![a](a.png)'),
    images: ['a.png'],
  },
  {
    name: 'tabs inside disclosures',
    source: '??? note\n\n' + indent(tab('![a](a.png)') + tab('![b](b.png)')),
    images: ['a.png', 'b.png'],
  },
  {
    name: 'nested tabs through admonitions fall back',
    source: tab('!!! note\n\n' + indent(tab('![fake](no.png)'))),
    images: [],
  },
  {
    name: 'oversized group falls back completely',
    source: tab('![fake](no.png)').repeat(17),
    images: [],
  },
  {
    name: 'oversized source falls back',
    source: tab('x'.repeat(128 * 1024) + '\n\n![fake](no.png)'),
    images: [],
  },
  { name: 'invalid label falls back', source: '=== ""\n\n    ![fake](no.png)', images: [] },
];
