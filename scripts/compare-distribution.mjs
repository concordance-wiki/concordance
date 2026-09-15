// Compares the reports that the distribution forms produced on the same
// repository, JSON reports or SARIF logs. The reports must be byte-identical
// once the version of the tool is normalised: a form that runs a published
// version reports that version, the others the one of the workspace, and the
// findings must not depend on it.
//
//   node scripts/compare-distribution.mjs <report.json>...
//   node scripts/compare-distribution.mjs <report.sarif>...
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

// The version sits under `tool` in a JSON report and under `tool.driver` in a SARIF log.
const forms = [
  {
    name: "JSON report",
    version: /("tool": \{\n\s*"name": "concordance",\n\s*"version": ")[^"]*(")/u,
  },
  {
    name: "SARIF log",
    version: /("driver": \{\n\s*"name": "concordance",\n\s*"version": ")[^"]*(")/u,
  },
];

/** The form of a report of concordance lint and its text with the version normalised; undefined for anything else. */
export function normaliseReport(text) {
  const form = forms.find((candidate) => candidate.version.test(text));
  if (form === undefined) return undefined;
  return { form: form.name, text: text.replace(form.version, "$1<version>$2") };
}

/** The reasons the reports, `{ path, text }` each, are not one report of the same form; empty when they are. */
export function compareReports(reports) {
  if (reports.length < 2) return ["give at least two reports"];
  const normalised = [];
  for (const { path, text } of reports) {
    const report = normaliseReport(text);
    if (report === undefined) return [`${path} is not a report of concordance lint`];
    normalised.push({ path, ...report });
  }
  const [reference, ...others] = normalised;
  const failures = [];
  for (const report of others) {
    if (report.form !== reference.form) {
      failures.push(`${report.path} is a ${report.form}, ${reference.path} a ${reference.form}`);
    } else if (report.text !== reference.text) {
      failures.push(`${report.path} differs from ${reference.path}`);
    }
  }
  return failures;
}

if (process.argv[1] !== undefined && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const paths = process.argv.slice(2);
  const failures = compareReports(
    paths.map((path) => ({ path, text: readFileSync(path, "utf8") })),
  );
  for (const failure of failures) console.error(`compare-distribution: ${failure}`);
  if (failures.length > 0) process.exit(1);
  console.log(`${String(paths.length)} reports are identical up to the tool version`);
}
