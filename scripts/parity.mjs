// Verifies that the project wiki keeps pace with the tool. The three
// demonstration repositories (demo-glossary, demo-specs, demo-wiki) are read
// from DEMO_ROOT, `..` by default; continuous integration clones them there at
// depth 1. Fails when a check page has no rule note, when a page slot has no
// screen note, when an active type of the default profile has no note across
// the repositories, or when a top-level configuration key or a check family has
// no glossary term. Nothing is built: the script reads sources and markdown.
import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { dirname, join, relative, resolve } from "node:path";
import { parse as parseYaml } from "yaml";

const root = resolve(dirname(new URL(import.meta.url).pathname), "..");
const demoRoot = resolve(root, process.env.DEMO_ROOT ?? "..");
const gaps = [];
const gap = (message) => gaps.push(message);

// The slots that draw the chrome around every page rather than a page of their own.
const CHROME_SLOTS = new Set(["Shell", "Header", "Footer"]);
const FALLBACK_TYPE = "document";

// Code-unit order, not locale order: the output must not depend on the collation data of the runtime.
const byCodeUnit = (a, b) => Number(a > b) - Number(a < b);

function walk(dir, predicate, out = []) {
  for (const name of readdirSync(dir).sort()) {
    const path = join(dir, name);
    if (name === "node_modules" || name === ".git") continue;
    if (statSync(path).isDirectory()) walk(path, predicate, out);
    else if (predicate(path)) out.push(path);
  }
  return out;
}

function readYaml(path) {
  return parseYaml(readFileSync(path, "utf8"));
}

function readNote(path) {
  const text = readFileSync(path, "utf8");
  const match = /^---\n([\s\S]*?)\n---\n/.exec(text);
  let frontmatter = {};
  if (match) {
    try {
      frontmatter = parseYaml(match[1]) ?? {};
    } catch {
      frontmatter = {};
    }
  }
  const body = match ? text.slice(match[0].length) : text;
  const title = /^#[ \t]+(\S.*)$/m.exec(body)?.[1]?.trim() ?? "";
  const aliases = Array.isArray(frontmatter.aliases) ? frontmatter.aliases.map(String) : [];
  const headings = [...body.matchAll(/^##[ \t]+(\S.*)$/gm)].map((m) => m[1].trim());
  return { frontmatter, title, aliases, headings };
}

// Compiles the `path` glob of a typing rule: `**` crosses folders, `*` and `?` stay in one.
function globToRegExp(glob) {
  let pattern = "";
  for (let i = 0; i < glob.length; i += 1) {
    const char = glob[i];
    if (char === "*") {
      if (glob[i + 1] === "*") {
        pattern += ".*";
        i += 1;
        if (glob[i + 1] === "/") i += 1;
      } else {
        pattern += "[^/]*";
      }
    } else if (char === "?") {
      pattern += "[^/]";
    } else {
      pattern += char.replace(/[.+^${}()|[\]\\]/g, String.raw`\$&`);
    }
  }
  return new RegExp(`^${pattern}$`);
}

// Whether a rule of a source applies to a file: every criterion it names must hold.
function ruleMatches(match, path, frontmatter) {
  if (match.path !== undefined && !globToRegExp(match.path).test(path)) return false;
  if (match.suffix !== undefined && !path.endsWith(match.suffix)) return false;
  if (match.ext !== undefined && !match.ext.some((ext) => path.endsWith(ext))) return false;
  return match.frontmatter === undefined || Object.hasOwn(frontmatter, match.frontmatter);
}

// The type cascade of the tool, on paths: the source's default type, its forced
// type, its rules in order (the last match winning), then the frontmatter.
function resolveType(source, path, frontmatter) {
  let type = source.type ?? source.default_type ?? FALLBACK_TYPE;
  for (const { match, set } of source.rules ?? []) {
    if (ruleMatches(match, path, frontmatter) && set.type !== undefined) type = String(set.type);
  }
  return typeof frontmatter.type === "string" ? frontmatter.type : type;
}

// The folder of a source declared in the wiki: a local path, or the repository named by its git URL.
function sourceFolder(source, configPath) {
  if (source.path) return resolve(dirname(configPath), source.path);
  const name = /\/([^/]+?)(?:\.git)?$/.exec(source.git ?? "")?.[1];
  return name ? join(demoRoot, name) : undefined;
}

const letters = (text) =>
  text
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "");
const singular = (word) => (word.length > 3 && word.endsWith("s") ? word.slice(0, -1) : word);
// The words of a phrase, each in the singular, so that a key, a family and a title compare alike.
const phrase = (text) =>
  text
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter(Boolean)
    .map(singular)
    .join(" ");

// 1. What the tool publishes: the check pages with their family, the slots, the
//    active types of the default profile and the top-level configuration keys.
const checkDir = join(root, "docs/checks");
const checks = readdirSync(checkDir)
  .filter((name) => name !== "README.md")
  .map((name) => {
    const id = name.replace(/\.md$/, "");
    const family = /\*\*Family:\*\*\s*([^.\s][^.]*)\./.exec(
      readFileSync(join(checkDir, name), "utf8"),
    );
    return { id, family: family ? family[1].trim() : undefined };
  });
const families = [...new Set(checks.flatMap((c) => (c.family ? [c.family] : [])))].sort(byCodeUnit);

const slotsSource = readFileSync(join(root, "packages/site/src/slots.ts"), "utf8");
const slotList = /SLOT_NAMES = \[([^\]]*)\]/.exec(slotsSource);
const slots = slotList ? [...slotList[1].matchAll(/"([A-Za-z]+)"/g)].map((m) => m[1]) : [];
const pageSlots = slots.filter((slot) => !CHROME_SLOTS.has(slot));

const profile = readYaml(join(root, "packages/profile/default.yaml"));
const activeTypes = Object.entries(profile.types)
  .filter(([, definition]) => definition.status !== "planned")
  .map(([type, definition]) => ({ type, group: definition.group }));

const schema = JSON.parse(
  readFileSync(join(root, "packages/core/schemas/config.schema.json"), "utf8"),
);
const configKeys = Object.keys(schema.properties).sort(byCodeUnit);

// 2. What the wiki holds: every note of every source the demo configuration declares,
//    with the type the cascade gives it.
const configPath = join(demoRoot, "demo-wiki/concordance.yaml");
if (!existsSync(configPath)) {
  console.error(`${configPath}: not found; set DEMO_ROOT to the folder holding the demo checkouts`);
  process.exit(2);
}
const config = readYaml(configPath);
const notes = [];
const present = new Map();
for (const source of config.sources) {
  const folder = sourceFolder(source, configPath);
  if (!folder || !existsSync(folder)) {
    console.error(`source ${source.name}: checkout not found under ${demoRoot}`);
    process.exit(2);
  }
  for (const file of walk(folder, (p) => p.endsWith(".md"))) {
    const path = relative(folder, file).replaceAll("\\", "/");
    const note = readNote(file);
    const type = resolveType(source, path, note.frontmatter);
    notes.push({ ...note, type, ref: `${source.name}/${path}` });
    present.set(type, (present.get(type) ?? 0) + 1);
  }
}
for (const application of config.applications ?? []) {
  if (application.id) present.set("application", (present.get("application") ?? 0) + 1);
}
for (const domain of config.domains ?? []) {
  if (domain.id) present.set("domain", (present.get("domain") ?? 0) + 1);
}

const ofType = (type) => notes.filter((note) => note.type === type);
const names = (note) => [note.title, ...note.aliases];

// 3. Every check page has a rule note naming the check: frontmatter `check`, an alias
//    or the identifier in the title; and the note says what the rule applies to.
const rules = ofType("rule");
for (const { id } of checks) {
  const matching = rules.filter(
    (note) => note.frontmatter.check === id || note.aliases.includes(id) || note.title.includes(id),
  );
  if (matching.length === 0) {
    gap(`check ${id}: no rules/ note names it (frontmatter check, alias or title)`);
    continue;
  }
  for (const note of matching) {
    if (!note.headings.some((heading) => /^applies to$/i.test(heading))) {
      gap(`check ${id}: ${note.ref} has no "## Applies to" section`);
    }
  }
}

// 4. Every slot that renders a page has a screen note whose title or alias reads
//    like the slot name, letters only (`KeywordPage` is "Keyword page", `EntityPage` "Entity page").
const screens = ofType("screen");
for (const slot of pageSlots) {
  const wanted = letters(slot);
  if (!screens.some((note) => names(note).some((name) => letters(name) === wanted))) {
    const words = slot.replace(/(?<=[a-z])(?=[A-Z])/g, " ").toLowerCase();
    gap(`slot ${slot}: no screens/ note is titled or aliased "${words}"`);
  }
}

// 5. Every active type of the default profile has at least one note of that type across
//    the repositories, an application or a domain being declared in the configuration.
//    Raw sources (documents, meetings) are files a reader converts rather than notes
//    someone writes: they are reported, never required.
for (const { type, group } of activeTypes) {
  const count = present.get(type) ?? 0;
  if (count === 0 && group !== "raw")
    gap(`type ${type}: no note of that type in the demo repositories`);
}

// 6. Every top-level configuration key and every check family has a glossary term.
const terms = ofType("term");
const hasTerm = (wanted) =>
  terms.some((note) => names(note).some((name) => phrase(name) === wanted));
for (const key of configKeys) {
  if (!hasTerm(phrase(key)))
    gap(`configuration key ${key}: no glossary term is titled or aliased like it`);
}
for (const family of families) {
  if (!hasTerm(phrase(`${family} checks`))) {
    gap(`check family "${family}": no glossary term is titled or aliased "${family} checks"`);
  }
}

if (gaps.length > 0) {
  for (const message of gaps) console.error(message);
  console.error(`${gaps.length} parity gap(s) between the tool and its wiki`);
  process.exit(1);
}
const typesPresent = activeTypes.map(({ type }) => `${type} ${present.get(type) ?? 0}`).join(", ");
console.log(
  `wiki parity: ${checks.length} checks have a rule note, ${pageSlots.length} page slots a screen note, ${configKeys.length} configuration keys and ${families.length} check families a glossary term; notes per active type: ${typesPresent}`,
);
