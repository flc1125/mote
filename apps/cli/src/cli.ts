#!/usr/bin/env node
import { run } from './run.js';

const code = await run(process.argv.slice(2), {
  stdout: (text) => console.log(text),
  stderr: (text) => console.error(text),
});

process.exitCode = code;
