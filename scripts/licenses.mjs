// Inventory of the third-party dependencies and their licences. Reads what
// pnpm installed (`pnpm licenses list --json --long`, once for everything and
// once for the runtime dependencies alone), writes docs/licenses.md, and fails
// when a dependency carries a licence outside the allow-list below. With
// `--check`, nothing is written: the script fails when the committed inventory
// differs from what it would write, so that the file cannot drift.
//
// Allow-list. The project is GPL-3.0-or-later; every runtime dependency must
// be compatible with it, and the development dependencies are held to the
// same rule so that nobody has to reason about which is which. Permissive
// licences (MIT, ISC, BSD, Apache-2.0, 0BSD, BlueOak-1.0.0, Python-2.0,
// Unlicense, CC0-1.0) and weak copyleft licences (MPL-2.0, LGPL) are compatible
// with GPL-3.0-or-later; so are GPL-3.0 itself and its "or later" variants.
// Anything else, including a package with no licence declared, fails.
//
// Exceptions. A package whose licence is outside the allow-list can be
// accepted individually, with the reason written next to it. The exception
// applies to the named package only, whatever its version.
import { execFileSync } from "node:child_process";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { pnpmCommand } from "./executables.mjs";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const inventory = join(root, "docs/licenses.md");
const check = process.argv.includes("--check");

const allowed = new Set([
  "0BSD",
  "Apache-2.0",
  "BlueOak-1.0.0",
  "BSD-2-Clause",
  "BSD-3-Clause",
  "CC0-1.0",
  "GPL-3.0",
  "GPL-3.0-only",
  "GPL-3.0-or-later",
  "ISC",
  "LGPL-2.1",
  "LGPL-2.1-only",
  "LGPL-2.1-or-later",
  "LGPL-3.0",
  "LGPL-3.0-only",
  "LGPL-3.0-or-later",
  "MIT",
  "MPL-2.0",
  "Python-2.0",
  "Unlicense",
]);

const exceptions = new Map([
  [
    "caniuse-lite",
    "browser support data under CC-BY-4.0, used by the development tooling only, never redistributed",
  ],
]);

/** A licence expression is accepted when every alternative it names is. */
function isAllowed(name, license) {
  if (exceptions.has(name)) return true;
  const alternatives = license
    .replace(/^\(|\)$/g, "")
    // The separator is taken from its first blank: retrying inside the run would make the runtime quadratic.
    .split(/(?<!\s)\s+OR\s+/)
    .map((s) => s.trim());
  return alternatives.every((alternative) => allowed.has(alternative));
}

function listLicenses(args) {
  const [command, ...prefix] = pnpmCommand();
  const output = execFileSync(
    command,
    [...prefix, "licenses", "list", "--json", "--long", ...args],
    {
      cwd: root,
      encoding: "utf8",
      stdio: ["ignore", "pipe", "inherit"],
    },
  );
  return Object.values(JSON.parse(output)).flat();
}

function readManifest(path) {
  return JSON.parse(readFileSync(join(path, "package.json"), "utf8"));
}

function repositoryUrl(manifest) {
  const repository = manifest.repository;
  const raw = typeof repository === "string" ? repository : (repository?.url ?? "");
  const url = raw
    .replace(/^git\+/, "")
    .replace(/^git:\/\//, "https://")
    .replace(/^ssh:\/\/git@/, "https://")
    .replace(/^git@([^:]+):/, "https://$1/")
    .replace(/^github:/, "https://github.com/")
    .replace(/\.git$/, "");
  if (/^https?:\/\//.test(url)) return url;
  if (/^[\w.-]+\/[\w.-]+$/.test(url)) return `https://github.com/${url}`;
  return typeof manifest.homepage === "string" ? manifest.homepage : "";
}

const runtime = new Set(listLicenses(["--prod"]).map((entry) => entry.name));
const rows = [];
const failures = [];

for (const entry of listLicenses([])) {
  entry.versions.forEach((version, index) => {
    const manifest = readManifest(entry.paths[index]);
    // pnpm resolves the licence from the manifest, including the legacy
    // `licenses` array, and reports "Unknown" when it finds none.
    const license = entry.license === "Unknown" ? "" : entry.license;
    if (!isAllowed(entry.name, license)) {
      failures.push(`${entry.name}@${version}: licence "${license || "none"}" is not allowed`);
    }
    // A native binary is chosen per platform at install time, so its row
    // would differ from one machine to another: it is reported under the
    // package that selects it.
    if (manifest.os || manifest.cpu) return;
    rows.push({
      name: entry.name,
      version,
      license: license || "none",
      scope: runtime.has(entry.name) ? "runtime" : "development",
      repository: repositoryUrl(manifest),
      optional: Object.keys(manifest.optionalDependencies ?? {}),
    });
  });
}

// Code-unit order, not locale order: the page must not depend on the collation data of the runtime.
const byCodeUnit = (a, b) => Number(a > b) - Number(a < b);
rows.sort((a, b) => byCodeUnit(a.name, b.name) || byCodeUnit(a.version, b.version));

// An optional dependency that is not installed as a regular package is a
// native binary, present for another platform or for this one.
const listed = new Set(rows.map((row) => row.name));
const binariesOf = (row) => row.optional.filter((name) => !listed.has(name)).sort();
const parents = rows.filter((row) => binariesOf(row).length > 0);
const escape = (text) => text.replaceAll("|", String.raw`\|`);
const link = (url) => (url ? `<${url}>` : "");
const lines = [
  "# Third-party licences",
  "",
  "Every package of this repository is published under the [GNU General Public License, version 3 or later](../LICENSE). This page lists the third-party packages that `pnpm install` brings in, with their licence, so that the compatibility of the whole can be checked at a glance.",
  "",
  "`scripts/licenses.mjs` generates this page from the installed dependencies and fails when a licence is outside its allow-list; `pnpm licenses:update` refreshes it, `pnpm licenses:check` verifies it in continuous integration. The scope says whether a package ships with the published packages (runtime) or serves the build, the tests and the linting only (development).",
  "",
  "| Package | Version | Licence | Scope | Repository |",
  "|---|---|---|---|---|",
  ...rows.map(
    (row) =>
      `| ${escape(row.name)} | ${row.version} | ${escape(row.license)} | ${row.scope} | ${link(row.repository)} |`,
  ),
];
if (parents.length > 0) {
  lines.push(
    "",
    "## Native binaries",
    "",
    "The packages below select a prebuilt binary for the current platform at install time. Each binary is a package of its own, absent from the table above because the installed one depends on the machine; the script checks its licence like any other.",
    "",
    "| Package | Licence | Binaries |",
    "|---|---|---|",
    ...parents.map(
      (row) =>
        `| ${escape(row.name)} | ${escape(row.license)} | ${binariesOf(row).map(escape).join(", ")} |`,
    ),
  );
}
const content = lines.join("\n") + "\n";

if (check) {
  const current = existsSync(inventory) ? readFileSync(inventory, "utf8") : "";
  if (current !== content) {
    failures.push(
      `${relative(root, inventory)} is out of date: run pnpm licenses:update and commit it`,
    );
  }
} else {
  writeFileSync(inventory, content);
}

if (failures.length > 0) {
  for (const message of failures) console.error(message);
  process.exit(1);
}
console.log(
  `${rows.length} dependencies, every licence in the allow-list, ${relative(root, inventory)} ${check ? "up to date" : "written"}`,
);
