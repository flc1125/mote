/** Adapt compact flowchart edges to the static parser without editing labels. */
export function normalizeFlowchart(source: string): string {
  return source
    .split('\n')
    .map((line) => {
      let result = '';
      let quote = false;
      let label = false;
      const brackets: string[] = [];
      for (let index = 0; index < line.length; index++) {
        const char = line[index]!;
        if (char === '\\') {
          result += line.slice(index, index + 2);
          index++;
          continue;
        }
        if (char === '"') quote = !quote;
        if (!quote) {
          if (!brackets.length && char === '|') label = !label;
          if (!label) {
            if ('([{'.includes(char)) brackets.push(char);
            else if (')]}'.includes(char)) brackets.pop();
          }
        }
        if (!quote && !label && !brackets.length) {
          if (line.startsWith('%%', index)) {
            result += line.slice(index);
            break;
          }
          if (char === ';') {
            result += '\n';
            continue;
          }
          const edge = /^<?(?:-->|-\.->|==>|---|-\.-|===|--(?=\s)|-\.(?=\s)|==(?=\s))/.exec(
            line.slice(index),
          );
          if (edge) {
            if (result && !/\s$/.test(result)) result += ' ';
            result += edge[0];
            index += edge[0].length - 1;
            continue;
          }
        }
        result += char;
      }
      return result;
    })
    .join('\n');
}
