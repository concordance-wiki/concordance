// Release notes of one version, gathered from the changelogs Changesets
// writes: the entries of every published workspace package for that version,
// each entry once however many packages carry it, grouped by bump, and the
// list of the packages at that version. The release workflow hands the result
// to `gh release create --notes-file`.
//
//   node scripts/release-notes.mjs <version> [--output notes.md]
import { existsSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { parseArgs } from "node:util";
import { parse as parseYaml } from "yaml";

const bumps = ["Major", "Minor", "Patch"];

// Code-unit order, not locale order: the output must not depend on the collation data of the runtime.
const byCodeUnit = (a, b) => Number(a > b) - Number(a < b);

/** The published packages of the workspace (every `<folder>/*` entry of pnpm-workspace.yaml that is not private), by name. */
export function publishedPackages(root) {
  const workspace = parseYaml(readFileSync(join(root, "pnpm-workspace.yaml"), "utf8"));
  const packages = [];
  for (const pattern of workspace.packages) {
    const folder = join(root, pattern.replace(/\/\*$/u, ""));
    for (const name of readdirSync(folder)) {
      const dir = join(folder, name);
      const manifest = join(dir, "package.json");
      if (!existsSync(manifest)) continue;
      const pkg = JSON.parse(readFileSync(manifest, "utf8"));
      if (pkg.private === true) continue;
      packages.push({ name: pkg.name, version: pkg.version, dir });
    }
  }
  return packages.sort((a, b) => byCodeUnit(a.name, b.name));
}

/** The `## <version>` section of a changelog, without its heading; undefined when the version has none. */
export function changelogSection(changelog, version) {
  const lines = changelog.split("\n");
  const start = lines.indexOf(`## ${version}`);
  if (start === -1) return undefined;
  const end = lines.findIndex((line, index) => index > start && line.startsWith("## "));
  return lines.slice(start + 1, end === -1 ? lines.length : end).join("\n");
}

/** The entries of a section by bump ("Major", "Minor", "Patch"), each entry with its continuation lines, dependency bumps left out. */
export function entriesByBump(section) {
  const entries = new Map(bumps.map((bump) => [bump, []]));
  let current;
  let entry;
  const flush = () => {
    if (
      entry !== undefined &&
      current !== undefined &&
      !entry.startsWith("- Updated dependencies")
    ) {
      entries.get(current).push(entry.trimEnd());
    }
    entry = undefined;
  };
  for (const line of section.split("\n")) {
    const heading = /^### (Major|Minor|Patch) Changes$/u.exec(line);
    if (heading !== null) {
      flush();
      current = heading[1];
    } else if (line.startsWith("- ")) {
      flush();
      entry = line;
    } else if (entry !== undefined) {
      entry += `\n${line}`;
    }
  }
  flush();
  return entries;
}

/** The notes of a version as markdown; throws when no published package has an entry for it. */
export function releaseNotes(root, version) {
  const packages = publishedPackages(root);
  const entries = new Map(bumps.map((bump) => [bump, []]));
  let found = false;
  for (const pkg of packages) {
    const changelog = join(pkg.dir, "CHANGELOG.md");
    if (!existsSync(changelog)) continue;
    const section = changelogSection(readFileSync(changelog, "utf8"), version);
    if (section === undefined) continue;
    found = true;
    for (const [bump, list] of entriesByBump(section)) {
      const known = entries.get(bump);
      for (const entry of list) if (!known.includes(entry)) known.push(entry);
    }
  }
  if (!found) throw new Error(`no changelog carries an entry for version ${version}`);
  const parts = [`## v${version}`];
  for (const bump of bumps) {
    const list = entries.get(bump);
    if (list.length === 0) continue;
    parts.push(`### ${bump} changes`, list.join("\n"));
  }
  const at = packages.filter((pkg) => pkg.version === version).map((pkg) => `\`${pkg.name}\``);
  parts.push(`### Packages at ${version}`, at.join(", "));
  return `${parts.join("\n\n")}\n`;
}

if (process.argv[1] !== undefined && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const { values, positionals } = parseArgs({
    options: { output: { type: "string" } },
    allowPositionals: true,
  });
  const version = positionals[0];
  if (version === undefined) {
    console.error("usage: node scripts/release-notes.mjs <version> [--output notes.md]");
    process.exit(2);
  }
  const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
  const notes = releaseNotes(root, version);
  if (values.output === undefined) process.stdout.write(notes);
  else writeFileSync(resolve(values.output), notes);
}
