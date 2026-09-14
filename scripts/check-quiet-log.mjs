#!/usr/bin/env node
// Fails when the log of a passing test run carries a trace nobody asserted on: a request the
// DOM made to a closed port, a frame aborted at teardown, a bundler warning. Usage:
// node scripts/check-quiet-log.mjs <log file>
import { readFileSync } from "node:fs";

const NOISE =
  /ECONNREFUSED|DOMException|AbortError|NetworkError|NotSupportedError|\[vite\] .*warning/u;

const [file] = process.argv.slice(2);
if (file === undefined) {
  console.error("usage: check-quiet-log.mjs <log file>");
  process.exit(2);
}
const lines = readFileSync(file, "utf8").split("\n");
const noisy = lines.filter((line) => NOISE.test(line));
for (const line of noisy.slice(0, 20)) console.error(line);
if (noisy.length > 0) {
  console.error(`${String(noisy.length)} noisy lines in ${file}`);
  process.exit(1);
}
console.log(`${file}: quiet`);
