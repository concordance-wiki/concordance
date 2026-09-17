// Validates what the repository publishes without any engine code: the JSON
// schemas themselves, the default profile, the brand theme, the fixture
// configurations, the note templates, the relative links of the docs, the
// licence of every workspace package, the manifest and the tarball of every
// published one, the one version they all carry.
import { readFileSync, readdirSync, statSync, existsSync } from "node:fs";
import { join, dirname, resolve, relative } from "node:path";
import { fileURLToPath } from "node:url";
import Ajv2020 from "ajv/dist/2020.js";
import addFormats from "ajv-formats";
import { parse as parseYaml } from "yaml";

import { assembleProfileText, profileFile, typesDirectory } from "./assemble-profile.mjs";
import { checkDistribution } from "./check-distribution.mjs";
import { checkPackaging, checkVersions } from "./check-packaging.mjs";
import { generateReference } from "./config-reference.mjs";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const failures = [];
const fail = (message) => failures.push(message);

const ajv = new Ajv2020({ strict: true, allErrors: true, allowUnionTypes: true });
addFormats(ajv);

// Code-unit order, not locale order: the output must not depend on the collation data of the runtime.
const byCodeUnit = (a, b) => Number(a > b) - Number(a < b);

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
for (const name of readdirSync(schemaDir).sort(byCodeUnit)) {
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

// 4. The default profile is the assembly of base.yaml and the type modules
//    (scripts/assemble-profile.mjs refreshes it), every module validates
//    against its schema with the messages it needs, every profile type that is
//    active in the first version has a template, and every template declares
//    a type known to the profile.
if (readFileSync(profileFile, "utf8") !== assembleProfileText()) {
  fail(
    "packages/profile/default.yaml: differs from the type modules, run node scripts/assemble-profile.mjs",
  );
}
const profile = readYaml(join(root, "packages/profile/default.yaml"));
const modules = readdirSync(typesDirectory).sort(byCodeUnit);
for (const slug of modules) {
  const folder = join(typesDirectory, slug);
  const declaration = readYaml(join(folder, "type.yaml"));
  validateAgainst("type-module.schema.json", join(folder, "type.yaml"), declaration);
  const messagesFile = join(folder, "messages/en.json");
  if (!existsSync(messagesFile)) {
    fail(`packages/profile/types/${slug}: messages/en.json is missing`);
    continue;
  }
  const messages = JSON.parse(readFileSync(messagesFile, "utf8"));
  const keys = Object.keys(messages);
  if (keys.join() !== [...keys].sort(byCodeUnit).join()) {
    fail(`packages/profile/types/${slug}/messages/en.json: keys are not sorted`);
  }
  for (const key of [
    "label",
    ...Object.keys(declaration.sections ?? {}).map((k) => `sections.${k}`),
  ]) {
    if (messages[key] === undefined)
      fail(`packages/profile/types/${slug}/messages/en.json: ${key} is missing`);
  }
  for (const key of keys) {
    const [kind, name] = key.split(".");
    const known =
      key === "label" ||
      key === "description" ||
      key === "counted" ||
      (kind === "attributes" && declaration.attributes?.[name] !== undefined) ||
      (kind === "sections" && declaration.sections?.[name] !== undefined);
    if (!known)
      fail(
        `packages/profile/types/${slug}/messages/en.json: ${key} names nothing the module declares`,
      );
    if (
      typeof messages[key]?.defaultMessage !== "string" ||
      typeof messages[key]?.description !== "string"
    ) {
      fail(
        `packages/profile/types/${slug}/messages/en.json: ${key} needs defaultMessage and description`,
      );
    }
  }
  const frenchFile = join(folder, "messages/fr.json");
  const french = existsSync(frenchFile) ? JSON.parse(readFileSync(frenchFile, "utf8")) : {};
  for (const key of keys) {
    if (typeof french[key] !== "string")
      fail(`packages/profile/types/${slug}/messages/fr.json: ${key} is missing`);
  }
  for (const key of Object.keys(french)) {
    if (messages[key] === undefined)
      fail(`packages/profile/types/${slug}/messages/fr.json: ${key} is not in en.json`);
  }
}
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
  const module = join(typesDirectory, type, "template.md");
  if (!existsSync(module)) {
    fail(
      `docs/templates/${name}: no template.md in the type module, run node scripts/sync-templates.mjs`,
    );
  } else if (readFileSync(module, "utf8") !== readFileSync(join(templateDir, name), "utf8")) {
    fail(
      `docs/templates/${name}: differs from the type module, run node scripts/sync-templates.mjs`,
    );
  }
}
for (const slug of modules) {
  if (existsSync(join(typesDirectory, slug, "template.md")) && !templates.includes(`${slug}.md`)) {
    fail(
      `packages/profile/types/${slug}/template.md: not in docs/templates, run node scripts/sync-templates.mjs`,
    );
  }
}
for (const [type, definition] of Object.entries(profile.types)) {
  if (definition.status !== "planned" && !templates.includes(`${type}.md`)) {
    fail(`docs/templates: no template for active type ${type}`);
  }
}

// 5. The copy the command line ships equals docs/templates, file for file
//    (scripts/sync-templates.mjs refreshes it).
const shippedDir = join(root, "packages/cli/templates");
const shipped = existsSync(shippedDir) ? readdirSync(shippedDir).sort(byCodeUnit) : [];
const published = readdirSync(templateDir).sort(byCodeUnit);
for (const name of published) {
  if (!shipped.includes(name)) {
    fail(`packages/cli/templates/${name}: missing, run node scripts/sync-templates.mjs`);
  } else if (
    readFileSync(join(shippedDir, name), "utf8") !== readFileSync(join(templateDir, name), "utf8")
  ) {
    fail(
      `packages/cli/templates/${name}: differs from docs/templates, run node scripts/sync-templates.mjs`,
    );
  }
}
for (const name of shipped) {
  if (!published.includes(name)) {
    fail(
      `packages/cli/templates/${name}: not in docs/templates, run node scripts/sync-templates.mjs`,
    );
  }
}

// 6. Relative markdown links resolve, except in the faulty corpus, which breaks
//    one on purpose, and in the templates of the type modules, which link the
//    other templates as copied side by side under templates/ (the core ones
//    are checked in their docs/templates copy, identical by section 4).
const linkPattern = /\[[^[\]]*\]\(([^)\s]+)\)/g;
for (const path of walk(
  root,
  (p) =>
    p.endsWith(".md") &&
    !p.includes("/fixtures/corpora/faulty/") &&
    !/\/types\/[a-z][a-z0-9_]*\/template\.md$/.test(p),
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

// 7. Every message catalogue file, one per language and area, is a well-formed
//    JSON object with sorted keys under the prefix the file is named after: the
//    source carries a default message and a description per entry, a
//    translation a string per entry. Parity between locales is a unit test.
const messageDir = join(root, "packages/i18n/messages");
for (const language of readdirSync(messageDir).sort(byCodeUnit)) {
  for (const name of readdirSync(join(messageDir, language)).sort(byCodeUnit)) {
    const file = `packages/i18n/messages/${language}/${name}`;
    const area = name.replace(/\.json$/, "");
    let catalogue;
    try {
      catalogue = JSON.parse(readFileSync(join(messageDir, language, name), "utf8"));
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
      if (!id.startsWith(`${area}.`)) fail(`${file}: ${id} is not under the ${area} prefix`);
      const valid =
        language === "en"
          ? typeof entry?.defaultMessage === "string" && typeof entry?.description === "string"
          : typeof entry === "string";
      if (!valid) fail(`${file}: entry ${id} is malformed`);
    }
  }
}

// 8. Every check page carries a valid identifier, and every check named in the
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

// 9. The organisation home page is a single hand-written HTML document: every
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
// The attributes, when present, open with a character the name cannot hold: the engine never shifts name characters into them.
for (const match of page.matchAll(
  /<(\/?)([a-zA-Z][a-zA-Z0-9-]*)(?:[^>a-zA-Z0-9-][^>]*?)??(\/?)>/g,
)) {
  const [, closing, name, selfClosing] = match;
  const tag = name.toLowerCase();
  if (voidTags.has(tag) || selfClosing) continue;
  opened.set(tag, (opened.get(tag) ?? 0) + (closing ? -1 : 1));
}
for (const [tag, balance] of [...opened].sort(([a], [b]) => byCodeUnit(a, b))) {
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

// 10. Every expected result of a corpus names things that exist: an entity names a file of its
//    source, a link joins two entities (or an application, or a non-markdown resource), a finding
//    with a path names a file. The identifiers follow the derivation of the engine: source name,
//    slugified path segments, type suffix or extension stripped from the file name.
const slugify = (segment) =>
  segment
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    // The collapse above leaves no two dashes together, so a dash at either end stands alone.
    .replace(/^-|-$/g, "");
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
    if (!found?.markdown)
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

// 11. Every workspace package carries the licence of the project.
const licence = "GPL-3.0-or-later";
for (const path of walk(root, (p) => p.endsWith("/package.json"))) {
  const manifest = JSON.parse(readFileSync(path, "utf8"));
  if (manifest.license !== licence) {
    fail(`${relative(root, path)}: license must be ${licence}, found ${manifest.license}`);
  }
}

// 12. The distribution forms expose their documented inputs and pin the version of the command line.
for (const message of checkDistribution(root)) fail(message);

// 13. The reference pages under docs/reference are what the schemas give, and every
//     property of those schemas carries a description (scripts/config-reference.mjs
//     regenerates the pages).
for (const page of generateReference(root)) {
  for (const path of page.missing) {
    fail(`packages/core/schemas/${page.schema}: ${path} has no description`);
  }
  const file = join(root, page.page);
  if (!existsSync(file)) {
    fail(`${page.page}: missing, run pnpm reference:update`);
  } else if (readFileSync(file, "utf8") !== page.content) {
    fail(`${page.page}: differs from ${page.schema}, run pnpm reference:update`);
  }
}

// 14. Every YAML block of the pipeline examples parses: they are meant to be copied.
const pipelines = readFileSync(join(root, "docs/guides/pipelines.md"), "utf8");
let yamlBlocks = 0;
for (const match of pipelines.matchAll(/```ya?ml\n([\s\S]*?)```/g)) {
  yamlBlocks += 1;
  try {
    const document = parseYaml(match[1]);
    if (typeof document !== "object" || document === null) {
      fail(`docs/guides/pipelines.md: YAML block ${String(yamlBlocks)} is not a mapping`);
    }
  } catch (error) {
    fail(
      `docs/guides/pipelines.md: YAML block ${String(yamlBlocks)} does not parse: ${error.message}`,
    );
  }
}
if (yamlBlocks === 0) fail("docs/guides/pipelines.md: no YAML block found");

// 15. The usage block of the command-line guide is the one `concordance --help` prints.
const mainSource = readFileSync(join(root, "packages/cli/src/main.ts"), "utf8");
const usageArray = mainSource.slice(
  mainSource.indexOf("export const usage = ["),
  mainSource.indexOf("];", mainSource.indexOf("export const usage = [")),
);
const usageLines = [...usageArray.matchAll(/^\s*"((?:[^"\\]|\\.)*)",?\s*$/gm)].map((match) =>
  match[1].replaceAll('\\"', '"'),
);
const commandLineGuide = readFileSync(join(root, "docs/guides/command-line.md"), "utf8");
const usageBlock = /```\n(usage: concordance[\s\S]*?)```/.exec(commandLineGuide);
if (usageBlock === null) {
  fail("docs/guides/command-line.md: no usage block found");
} else if (usageBlock[1] !== `${usageLines.join("\n")}\n`) {
  fail(
    "docs/guides/command-line.md: the usage block differs from the usage of packages/cli/src/main.ts",
  );
}

// 15. A published package ships neither its tests, nor its sources, nor its fixtures: its
//     manifest carries the registry fields, lists only the built and shipped folders, points
//     at them, and the tarball pnpm would pack holds nothing else (scripts/check-packaging.mjs).
for (const message of checkPackaging(root)) fail(message);

// 16. Every published package carries the same version: they form the `fixed` group of
//     .changeset/config.json and a release bumps them together (scripts/check-packaging.mjs).
for (const message of checkVersions(root)) fail(message);

if (failures.length > 0) {
  for (const message of failures) console.error(message);
  console.error(`${failures.length} validation failure(s)`);
  process.exit(1);
}
console.log(
  "schemas, profile and its type modules, theme, fixtures, expected results, templates and their copies, links, message catalogues, check pages, home page, licences, distribution manifests, reference pages, pipeline examples, usage text, package manifests and versions are valid",
);
