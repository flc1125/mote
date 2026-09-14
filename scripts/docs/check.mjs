import { execFileSync } from 'node:child_process';
import console from 'node:console';
import { existsSync, readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import process from 'node:process';
import { checkDocuments } from './documents.mjs';
import { checkContracts } from './contracts.mjs';

export function checkRepository(root) {
  const files = execFileSync('git', ['ls-files', '-z'], { cwd: root, encoding: 'utf8' })
    .split('\0')
    .filter(Boolean)
    .filter((file) => !/(^|\/)(?:\.docs|node_modules|dist|\.wrangler|coverage)(\/|$)/.test(file));
  const read = (file) => readFileSync(resolve(root, file), 'utf8');
  const result = checkDocuments(files, read, (file) => existsSync(resolve(root, file)));
  result.errors.push(...checkContracts(read, result.documents));
  return result;
}

// Importable for tests; execution always uses this checkout, regardless of cwd.
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    const result = checkRepository(resolve(dirname(fileURLToPath(import.meta.url)), '../..'));
    for (const error of result.errors) {
      console.error(`${error.file}:${error.line}: ${error.message}`);
    }
    console.log(
      `docs:check: ${result.documents.size} Markdown files, ${result.references} local references, ` +
        `${result.external} external/versioned references (not fetched), ${result.errors.length} errors`,
    );
    process.exitCode = result.errors.length ? 1 : 0;
  } catch (error) {
    console.error(`docs:check: ${error.message}`);
    process.exitCode = 1;
  }
}
