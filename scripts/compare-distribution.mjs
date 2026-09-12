// Compares the JSON reports that the distribution forms produced on the same
// repository. The reports must be byte-identical once `tool.version` is
// normalised: a form that runs a published version reports that version, the
// others the one of the workspace, and the findings must not depend on it.
//
//   node scripts/compare-distribution.mjs <report.json>...
import { readFileSync } from "node:fs";

const versionField = /("tool": \{\n\s*"name": "concordance",\n\s*"version": ")[^"]*(")/u;
const reports = process.argv.slice(2);
if (reports.length < 2) {
  console.error("compare-distribution: give at least two JSON reports");
  process.exit(1);
}

const normalised = reports.map((path) => {
  const text = readFileSync(path, "utf8");
  if (!versionField.test(text)) {
    console.error(`compare-distribution: ${path} is not a JSON report of concordance lint`);
    process.exit(1);
  }
  return { path, text: text.replace(versionField, "$1<version>$2") };
});

const [reference, ...others] = normalised;
const differing = others.filter((report) => report.text !== reference.text);
if (differing.length > 0) {
  for (const report of differing) {
    console.error(`compare-distribution: ${report.path} differs from ${reference.path}`);
  }
  process.exit(1);
}
console.log(`${String(reports.length)} reports are identical up to tool.version`);
