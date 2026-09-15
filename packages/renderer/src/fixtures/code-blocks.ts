// Synthetic phase-0 inputs promoted to product regressions. Expected values
// describe the supported contract, rather than the pre-feature HTML baseline.
const fence = (info: string, body: string) => `\`\`\`${info}\n${body}\n\`\`\`\n`;
export const codeBlockCases = [
  {
    id: 'C01',
    input: fence(
      'ts title="config.ts" linenums="10" hl_lines="2-3"',
      'const config = {\n  timeout: 3000,\n  retries: 2,\n};',
    ),
    title: 'config.ts',
    numbers: ['10', '11', '12', '13'],
    highlights: 2,
    copy: true,
  },
  {
    id: 'C02',
    input: fence('js title="" linenums="0" hl_lines="1-999999999999"', 'const value = 1;'),
    copy: true,
  },
  { id: 'C03', input: fence('js title="first" title="second"', 'const value = 1;'), copy: true },
  {
    id: 'C04',
    input: fence(
      'js title="<img src=x onerror=alert(1)>"',
      '/* line one\nline two */\nconst value = `first\nsecond`;',
    ),
    title: '&lt;img src=x onerror=alert(1)&gt;',
    copy: true,
  },
  { id: 'C05', input: '```text title="CRLF"\r\none\r\ntwo\r\n```\r\n', title: 'CRLF', copy: true },
  {
    id: 'C06',
    input: fence('unknown title="plain" hl_lines="1"', '<script>text</script>'),
    title: 'plain',
    highlights: 1,
    copy: true,
  },
  { id: 'C07', input: '```text title="empty"\n```\n', title: 'empty', copy: false },
  { id: 'C08', input: fence('mermaid title="flow"', 'graph LR\nA-->B'), copy: false },
  {
    id: 'C09',
    input: fence('js onclick="alert(1)" title="unsafe"', 'const value = 1;'),
    copy: true,
  },
  { id: 'C10', input: fence('title="without-language"', 'plain'), copy: true },
] satisfies {
  id: string;
  input: string;
  title?: string;
  numbers?: string[];
  highlights?: number;
  copy: boolean;
}[];
