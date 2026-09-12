// Structural checks of the distribution forms that continuous integration
// cannot run end to end: the GitHub action, the GitLab CI/CD component and
// the pre-commit hook must expose the documented inputs, produce the
// documented reports and pin the version of the command line they run, the
// one of packages/cli. `--write` rewrites the three pins to that version
// after a release bump. Run standalone or through scripts/validate.mjs.
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { parse as parseYaml, parseAllDocuments } from "yaml";

const packageName = "@concordance-wiki/cli";
const files = {
  action: "distribution/github-action/action.yml",
  component: "distribution/gitlab-component/templates/lint.yml",
  hooks: ".pre-commit-hooks.yaml",
};
const pins = [
  { file: files.action, pattern: /(\n {2}version:\n(?: {4}.*\n)*? {4}default: ")[^"]*(")/u },
  { file: files.component, pattern: /(\n {4}version:\n(?: {6}.*\n)*? {6}default: ")[^"]*(")/u },
  { file: files.hooks, pattern: /(@concordance-wiki\/cli@)[^"\s]*()/u },
];

const isObject = (value) => typeof value === "object" && value !== null && !Array.isArray(value);

export function cliVersion(root) {
  return JSON.parse(readFileSync(join(root, "packages/cli/package.json"), "utf8")).version;
}

function checkAction(root, version, fail) {
  const file = files.action;
  const action = parseYaml(readFileSync(join(root, file), "utf8"));
  if (action?.runs?.using !== "composite") fail(`${file}: runs.using must be composite`);
  const inputs = isObject(action?.inputs) ? action.inputs : {};
  for (const name of [
    "version",
    "fail-on",
    "source",
    "config",
    "working-directory",
    "format",
    "output",
    "upload",
    "command",
  ]) {
    if (!isObject(inputs[name]) || !("default" in inputs[name]))
      fail(`${file}: input ${name} is missing or has no default`);
  }
  if (inputs.version?.default !== version)
    fail(`${file}: input version defaults to ${String(inputs.version?.default)}, not ${version}`);
  if (inputs["fail-on"]?.default !== "error") fail(`${file}: input fail-on must default to error`);
  const steps = Array.isArray(action?.runs?.steps) ? action.runs.steps : [];
  const uses = steps.map((step) => String(step?.uses ?? ""));
  if (!uses.some((u) => u.startsWith("actions/setup-node@")))
    fail(`${file}: no actions/setup-node step`);
  if (!uses.some((u) => u.startsWith("github/codeql-action/upload-sarif@")))
    fail(`${file}: no github/codeql-action/upload-sarif step`);
  if (!steps.some((step) => String(step?.run ?? "").includes(`npx --yes ${packageName}@`)))
    fail(`${file}: no step runs npx --yes ${packageName}@<version>`);
}

function checkComponent(root, version, fail) {
  const file = files.component;
  const documents = parseAllDocuments(readFileSync(join(root, file), "utf8")).map((d) => d.toJS());
  if (documents.length !== 2) {
    fail(`${file}: expected the spec document and the jobs document`);
    return;
  }
  const [spec, jobs] = documents;
  const inputs = isObject(spec?.spec?.inputs) ? spec.spec.inputs : {};
  for (const name of ["version", "fail_on", "source", "config"]) {
    if (!isObject(inputs[name]) || !("default" in inputs[name]))
      fail(`${file}: spec input ${name} is missing or has no default`);
  }
  if (inputs.version?.default !== version)
    fail(
      `${file}: spec input version defaults to ${String(inputs.version?.default)}, not ${version}`,
    );
  const failOn = inputs.fail_on ?? {};
  if (failOn.default !== "error" || String(failOn.options) !== "error,warning,info")
    fail(`${file}: spec input fail_on must default to error among error, warning and info`);
  const job = isObject(jobs) ? jobs["concordance-lint"] : undefined;
  if (!isObject(job)) {
    fail(`${file}: no concordance-lint job`);
    return;
  }
  const script = Array.isArray(job.script) ? job.script.join("\n") : "";
  if (!script.includes(`${packageName}@`)) fail(`${file}: the job does not run ${packageName}`);
  const artifacts = isObject(job.artifacts) ? job.artifacts : {};
  const paths = Array.isArray(artifacts.paths) ? artifacts.paths : [];
  const junit = artifacts.reports?.junit;
  if (typeof junit !== "string") fail(`${file}: the job publishes no JUnit report`);
  else if (!paths.includes(junit) || !script.includes(`--format junit --output ${junit}`))
    fail(`${file}: the JUnit report ${junit} is not produced and kept as an artifact`);
  const sarif = paths.find((p) => String(p).endsWith(".sarif"));
  if (sarif === undefined || !script.includes(`--format sarif --output ${sarif}`))
    fail(`${file}: no SARIF report is produced and kept as an artifact`);
  if (artifacts.when !== "always") fail(`${file}: artifacts must be kept when the job fails`);
}

function checkHooks(root, version, fail) {
  const file = files.hooks;
  const hooks = parseYaml(readFileSync(join(root, file), "utf8"));
  const hook = Array.isArray(hooks) ? hooks.find((h) => h?.id === "concordance-lint") : undefined;
  if (!isObject(hook)) {
    fail(`${file}: no hook with id concordance-lint`);
    return;
  }
  const expected = {
    language: "node",
    entry: "concordance lint --scope repo",
    pass_filenames: false,
  };
  for (const [key, value] of Object.entries(expected)) {
    if (hook[key] !== value) fail(`${file}: hook ${key} must be ${String(value)}`);
  }
  const dependencies = Array.isArray(hook.additional_dependencies)
    ? hook.additional_dependencies
    : [];
  if (!dependencies.includes(`${packageName}@${version}`))
    fail(`${file}: additional_dependencies must pin ${packageName}@${version}`);
}

/** Every failure of the three manifests, as one line each; empty when they are sound. */
export function checkDistribution(root) {
  const failures = [];
  const fail = (message) => failures.push(message);
  const version = cliVersion(root);
  checkAction(root, version, fail);
  checkComponent(root, version, fail);
  checkHooks(root, version, fail);
  return failures;
}

/** Rewrites the version pinned by the three manifests to the version of packages/cli. */
export function writeDistributionVersion(root) {
  const version = cliVersion(root);
  for (const { file, pattern } of pins) {
    const path = join(root, file);
    const text = readFileSync(path, "utf8");
    const updated = text.replace(pattern, `$1${version}$2`);
    if (updated === text && !text.includes(version)) {
      throw new Error(`${file}: the version pin was not found`);
    }
    writeFileSync(path, updated);
  }
  return version;
}

if (process.argv[1] !== undefined && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
  if (process.argv.includes("--write")) {
    console.log(
      `distribution manifests pinned to ${packageName}@${writeDistributionVersion(root)}`,
    );
  }
  const failures = checkDistribution(root);
  for (const message of failures) console.error(message);
  if (failures.length > 0) process.exit(1);
  console.log("the GitHub action, the GitLab component and the pre-commit hook are sound");
}
