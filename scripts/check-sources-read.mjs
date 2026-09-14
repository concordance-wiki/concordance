#!/usr/bin/env node
// Fails when a build read fewer sources than the corpus declares: the log names the ones it
// could not reach. Usage: node scripts/check-sources-read.mjs <build.log.json> <expected>
import { readFileSync } from "node:fs";

const [file, expected] = process.argv.slice(2);
if (file === undefined || expected === undefined) {
  console.error("usage: check-sources-read.mjs <build.log.json> <expected sources>");
  process.exit(2);
}
const log = JSON.parse(readFileSync(file, "utf8"));
const unreachable = log.findings.filter((finding) => finding.check === "W-SOURCE-UNREACHABLE");
for (const finding of unreachable) console.error(finding.message);
const read = log.summary.sources;
if (read !== Number(expected) || unreachable.length > 0) {
  console.error(`${String(read)} of ${expected} sources read`);
  process.exit(1);
}
console.log(`${String(read)} sources read`);
