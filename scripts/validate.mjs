// Validates what the repository publishes without any engine code: the JSON
// schemas themselves, the default profile, the brand theme, the fixture
// configurations, the note templates and the relative links of the docs.
import { readFileSync, readdirSync, statSync, existsSync } from "node:fs";
import { join, dirname, resolve, relative } from "node:path";
import Ajv2020 from "ajv/dist/2020.js";
import addFormats from "ajv-formats";
import { parse as parseYaml } from "yaml";

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
const schemaDir = join(root, "schemas");
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
validateAgainst("profile.schema.json", join(root, "profiles/default.yaml"), readYaml(join(root, "profiles/default.yaml")));
validateAgainst("theme.schema.json", join(root, "brand/theme.yaml"), readYaml(join(root, "brand/theme.yaml")));

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
const profile = readYaml(join(root, "profiles/default.yaml"));
const templateDir = join(root, "docs/templates");
const templates = readdirSync(templateDir).filter((n) => n.endsWith(".md") && n !== "README.md");
const frontmatter = (text) => {
  const match = /^---\n([\s\S]*?)\n---\n/.exec(text);
  return match ? parseYaml(match[1]) : {};
};
for (const name of templates) {
  const fm = frontmatter(readFileSync(join(templateDir, name), "utf8"));
  const type = name.replace(/\.md$/, "");
  if (fm.type !== type) fail(`docs/templates/${name}: frontmatter type ${fm.type} does not match the file name`);
  if (!profile.types[type]) fail(`docs/templates/${name}: type ${type} is not in the default profile`);
}
for (const [type, definition] of Object.entries(profile.types)) {
  if (definition.status !== "planned" && !templates.includes(`${type}.md`)) {
    fail(`docs/templates: no template for active type ${type}`);
  }
}

// 5. Relative markdown links resolve, except in the faulty corpus, which breaks one on purpose.
const linkPattern = /\[[^\]]*\]\(([^)\s]+)\)/g;
for (const path of walk(root, (p) => p.endsWith(".md") && !p.includes("/fixtures/corpora/faulty/"))) {
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

// 6. Every check page carries a valid identifier, and every check named in the
//    fixtures has a page.
const checkDir = join(root, "docs/checks");
const pages = new Set(readdirSync(checkDir).filter((n) => n !== "README.md").map((n) => n.replace(/\.md$/, "")));
for (const id of pages) {
  if (!/^[EWI]-[A-Z0-9]+(-[A-Z0-9]+)*$/.test(id)) fail(`docs/checks/${id}.md: invalid check identifier`);
}
for (const path of walk(join(root, "fixtures"), (p) => p.endsWith("findings.yaml"))) {
  for (const finding of readYaml(path) ?? []) {
    if (!pages.has(finding.check)) fail(`${relative(root, path)}: check ${finding.check} has no documentation page`);
  }
}

if (failures.length > 0) {
  for (const message of failures) console.error(message);
  console.error(`${failures.length} validation failure(s)`);
  process.exit(1);
}
console.log("schemas, profile, theme, fixtures, templates, links and check pages are valid");
