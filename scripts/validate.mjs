// Validates what the repository publishes without any engine code: the JSON
// schemas themselves, the default profile, the brand theme, the fixture
// configurations, the note templates, the relative links of the docs, the
// licence of every workspace package.
import { readFileSync, readdirSync, statSync, existsSync } from "node:fs";
import { join, dirname, resolve, relative } from "node:path";
import Ajv2020 from "ajv/dist/2020.js";
import addFormats from "ajv-formats";
import { parse as parseYaml } from "yaml";

import { checkDistribution } from "./check-distribution.mjs";

const root = resolve(dirname(new URL(import.meta.url).pathname), "..");
const failures = [];
const fail = (message) => failures.push(message);

const ajv = new Ajv2020({ strict: true, allErrors: true, allowUnionTypes: true });
addFormats(ajv);

function walk(dir, predicate, out = []) {
  for (const name of readdirSync(dir)) {
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

function validateAgainst(schemaName, path, data) {
  const validate = ajv.getSchema(schemaName);
  if (!validate(data)) {
    for (const error of validate.errors) {
      fail(`${relative(root, path)}: ${error.instancePath || "/"} ${error.message}`);
    }
    return false;
  }
  return true;
}

// 1. Schemas compile under strict mode.
const schemaDir = join(root, "packages/core/schemas");
for (const name of readdirSync(schemaDir).sort()) {
  const schema = JSON.parse(readFileSync(join(schemaDir, name), "utf8"));
  try {
    ajv.addSchema(schema, name);
    ajv.getSchema(name);
  } catch (error) {
    fail(`schemas/${name}: ${error.message}`);
  }
}

// 2. The default profile and the brand theme validate.
validateAgainst(
  "profile.schema.json",
  join(root, "packages/profile/default.yaml"),
  readYaml(join(root, "packages/profile/default.yaml")),
);
validateAgainst(
  "theme.schema.json",
  join(root, "brand/theme.yaml"),
  readYaml(join(root, "brand/theme.yaml")),
);

// 3. Every fixture configuration validates, and its sources exist.
for (const path of walk(join(root, "fixtures"), (p) => p.endsWith("concordance.yaml"))) {
  const config = readYaml(path);
  if (validateAgainst("config.schema.json", path, config)) {
    for (const source of config.sources) {
      if (source.path && !existsSync(resolve(dirname(path), source.path))) {
        fail(`${relative(root, path)}: source ${source.name} points to a missing folder`);
      }
    }
  }
}

// 4. Every profile type that is active in the first version has a template,
//    and every template declares a type known to the profile.
const profile = readYaml(join(root, "packages/profile/default.yaml"));
const templateDir = join(root, "docs/templates");
const templates = readdirSync(templateDir).filter((n) => n.endsWith(".md") && n !== "README.md");
const frontmatter = (text) => {
  const match = /^---\n([\s\S]*?)\n---\n/.exec(text);
  return match ? parseYaml(match[1]) : {};
};
for (const name of templates) {
  const fm = frontmatter(readFileSync(join(templateDir, name), "utf8"));
  const type = name.replace(/\.md$/, "");
  if (fm.type !== type)
    fail(`docs/templates/${name}: frontmatter type ${fm.type} does not match the file name`);
  if (!profile.types[type])
    fail(`docs/templates/${name}: type ${type} is not in the default profile`);
}
for (const [type, definition] of Object.entries(profile.types)) {
  if (definition.status !== "planned" && !templates.includes(`${type}.md`)) {
    fail(`docs/templates: no template for active type ${type}`);
  }
}

// 5. Relative markdown links resolve, except in the faulty corpus, which breaks one on purpose.
const linkPattern = /\[[^\]]*\]\(([^)\s]+)\)/g;
for (const path of walk(
  root,
  (p) => p.endsWith(".md") && !p.includes("/fixtures/corpora/faulty/"),
)) {
  const text = readFileSync(path, "utf8").replace(/```[\s\S]*?```/g, "");
  for (const match of text.matchAll(linkPattern)) {
    const target = match[1];
    if (/^[a-z]+:/.test(target) || target.startsWith("#")) continue;
    const file = target.split("#")[0];
    if (file && !existsSync(resolve(dirname(path), file))) {
      fail(`${relative(root, path)}: broken link to ${target}`);
    }
  }
}

// 6. Every message catalogue is a well-formed JSON object with sorted keys:
//    the source carries a default message and a description per entry, a
//    translation a string per entry. Parity between locales is a unit test.
const messageDir = join(root, "packages/i18n/messages");
for (const name of readdirSync(messageDir).sort()) {
  const file = `packages/i18n/messages/${name}`;
  let catalogue;
  try {
    catalogue = JSON.parse(readFileSync(join(messageDir, name), "utf8"));
  } catch (error) {
    fail(`${file}: ${error.message}`);
    continue;
  }
  if (typeof catalogue !== "object" || catalogue === null || Array.isArray(catalogue)) {
    fail(`${file}: not a JSON object`);
    continue;
  }
  const keys = Object.keys(catalogue);
  if (keys.some((key, index) => index > 0 && keys[index - 1] > key)) {
    fail(`${file}: keys are not sorted`);
  }
  for (const [id, entry] of Object.entries(catalogue)) {
    const valid =
      name === "en.json"
        ? typeof entry?.defaultMessage === "string" && typeof entry?.description === "string"
        : typeof entry === "string";
    if (!valid) fail(`${file}: entry ${id} is malformed`);
  }
}

// 7. Every check page carries a valid identifier, and every check named in the
//    fixtures has a page.
const checkDir = join(root, "docs/checks");
const pages = new Set(
  readdirSync(checkDir)
    .filter((n) => n !== "README.md")
    .map((n) => n.replace(/\.md$/, "")),
);
for (const id of pages) {
  if (!/^[EWI]-[A-Z0-9]+(-[A-Z0-9]+)*$/.test(id))
    fail(`docs/checks/${id}.md: invalid check identifier`);
}
for (const path of walk(join(root, "fixtures"), (p) => p.endsWith("findings.yaml"))) {
  for (const finding of readYaml(path) ?? []) {
    if (!pages.has(finding.check))
      fail(`${relative(root, path)}: check ${finding.check} has no documentation page`);
  }
}

// 8. The organisation home page is a single hand-written HTML document: every
//    tag closed, absolute links, one inline script for the showcase slider, and
//    nothing fetched from a third party: the fonts ship next to it.
const home = join(root, "docs/site/index.html");
const page = readFileSync(home, "utf8");
const voidTags = new Set([
  "meta",
  "link",
  "br",
  "hr",
  "img",
  "input",
  "path",
  "rect",
  "circle",
  "line",
]);
const opened = new Map();
for (const match of page.matchAll(/<(\/?)([a-zA-Z][a-zA-Z0-9-]*)[^>]*?(\/?)>/g)) {
  const [, closing, name, selfClosing] = match;
  const tag = name.toLowerCase();
  if (voidTags.has(tag) || selfClosing) continue;
  opened.set(tag, (opened.get(tag) ?? 0) + (closing ? -1 : 1));
}
for (const [tag, balance] of [...opened].sort()) {
  if (balance !== 0)
    fail(`docs/site/index.html: <${tag}> opened and closed an unequal number of times`);
}
if (!/^<!doctype html>/i.test(page)) fail("docs/site/index.html: must start with <!doctype html>");
if (!/<title>[^<]+<\/title>/.test(page)) fail("docs/site/index.html: missing <title>");
if ((page.match(/<script[\s>]/gi) ?? []).length > 1) {
  fail("docs/site/index.html: carries more than the one inline script of the slider");
}
if (/<script\b[^>]*\bsrc=/i.test(page)) fail("docs/site/index.html: must not load a script");
for (const match of page.matchAll(/<link\b[^>]*href="([^"]*)"/g)) {
  if (!match[1].startsWith("data:")) {
    fail(`docs/site/index.html: link ${match[1]} is not an inline asset`);
  }
}
if (/<img\b/i.test(page)) fail("docs/site/index.html: must not reference an image file");
for (const match of page.matchAll(/url\("([^"]*)"\)/g)) {
  if (
    !/^fonts\/[a-z0-9-]+\.woff2$/.test(match[1]) ||
    !existsSync(join(root, "docs/site", match[1]))
  ) {
    fail(`docs/site/index.html: url(${match[1]}) is not a shipped font`);
  }
}
for (const match of page.matchAll(/<a\b[^>]*href="([^"]*)"/g)) {
  if (
    !/^https:\/\/[^\s"]+$/.test(match[1]) &&
    !/^#[a-z][a-z0-9-]*$/.test(match[1]) &&
    match[1] !== "#"
  ) {
    fail(`docs/site/index.html: link ${match[1]} is not an absolute https URL`);
  }
}

// 9. Every expected result of a corpus names things that exist: an entity names a file of its
//    source, a link joins two entities (or an application, or a non-markdown resource), a finding
//    with a path names a file. The identifiers follow the derivation of the engine: source name,
//    slugified path segments, type suffix or extension stripped from the file name.
const slugify = (segment) =>
  segment
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
function corpusIdentifiers(configPath, config) {
  const ids = new Map();
  for (const source of config.sources) {
    if (!source.path) continue;
    const folder = resolve(dirname(configPath), source.path);
    const suffixes = (source.rules ?? []).flatMap((rule) =>
      rule.match.suffix ? [rule.match.suffix] : [],
    );
    for (const file of walk(folder, () => true)) {
      const segments = relative(folder, file).split("/");
      const name = segments.pop();
      const suffix = suffixes
        .filter((s) => name.endsWith(s) && name.length > s.length)
        .sort((a, b) => b.length - a.length)[0];
      const base = suffix ? name.slice(0, -suffix.length) : name.replace(/\.[^.]+$/, "");
      const id = [source.name, ...segments.map(slugify), slugify(base)].join("/");
      ids.set(id, {
        source: source.name,
        path: relative(folder, file),
        markdown: name.endsWith(".md"),
      });
    }
  }
  return ids;
}
for (const path of walk(join(root, "fixtures/corpora"), (p) =>
  p.endsWith("/expected/entities.yaml"),
)) {
  const corpus = resolve(dirname(path), "..");
  const configPath = join(corpus, "concordance.yaml");
  const config = readYaml(configPath);
  const ids = corpusIdentifiers(configPath, config);
  const applications = new Set((config.applications ?? []).map((application) => application.id));
  const entities = new Set();
  for (const entity of readYaml(path) ?? []) {
    entities.add(entity.id);
    const found = ids.get(entity.id);
    if (!found || !found.markdown)
      fail(`${relative(root, path)}: entity ${entity.id} names no markdown file`);
  }
  const linksPath = join(corpus, "expected/links.yaml");
  if (existsSync(linksPath)) {
    for (const link of readYaml(linksPath) ?? []) {
      for (const end of [link.from, link.to]) {
        if (!entities.has(end) && !applications.has(end) && !ids.has(end)) {
          fail(
            `${relative(root, linksPath)}: ${end} is neither an expected entity, an application nor a resource`,
          );
        }
      }
    }
  }
  const findingsPath = join(corpus, "expected/findings.yaml");
  if (existsSync(findingsPath)) {
    for (const finding of readYaml(findingsPath) ?? []) {
      if (!finding.path) continue;
      const source = finding.source
        ? config.sources.find((candidate) => candidate.name === finding.source)
        : config.sources.find((candidate) => finding.path.startsWith(`${candidate.name}/`));
      const rest = finding.source
        ? finding.path
        : finding.path.slice((source?.name.length ?? 0) + 1);
      if (!source || !existsSync(resolve(dirname(configPath), source.path, rest))) {
        fail(
          `${relative(root, findingsPath)}: finding ${finding.check} names a missing file ${finding.path}`,
        );
      }
    }
  }
}

// 10. Every workspace package carries the licence of the project.
const licence = "GPL-3.0-or-later";
for (const path of walk(root, (p) => p.endsWith("/package.json"))) {
  const manifest = JSON.parse(readFileSync(path, "utf8"));
  if (manifest.license !== licence) {
    fail(`${relative(root, path)}: license must be ${licence}, found ${manifest.license}`);
  }
}

// 11. The distribution forms expose their documented inputs and pin the version of the command line.
for (const message of checkDistribution(root)) fail(message);

if (failures.length > 0) {
  for (const message of failures) console.error(message);
  console.error(`${failures.length} validation failure(s)`);
  process.exit(1);
}
console.log(
  "schemas, profile, theme, fixtures, expected results, templates, links, message catalogues, check pages, home page, licences and distribution manifests are valid",
);
