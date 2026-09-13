// Generates the reference pages under docs/reference from the JSON schemas of
// packages/core/schemas, so that the documentation of every key never diverges
// from what the command line validates: one section per object of the schema,
// a table per section (key, type, default, allowed values, description), the
// enumerations listed, the $refs followed once and linked afterwards. Every
// property of a generated schema must carry a description; a missing one is a
// validation failure. Run standalone to rewrite the pages (`pnpm
// reference:update`); scripts/validate.mjs imports it to compare the committed
// pages with what the schemas give, and to list the properties left undescribed.
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

/** The schemas published as a reference page, in the order of the index. */
export const referencePages = [
  {
    schema: "config.schema.json",
    page: "docs/reference/configuration.md",
    title: "Configuration reference",
    file: "concordance.yaml",
    guide: "../guides/configuration.md",
  },
  {
    schema: "theme.schema.json",
    page: "docs/reference/theme.md",
    title: "Theme reference",
    file: "theme.yaml",
    guide: "../guides/theming.md",
  },
  {
    schema: "profile.schema.json",
    page: "docs/reference/profile.md",
    title: "Profile reference",
    file: "profile.yaml",
    guide: "../guides/writing-notes.md#profile",
  },
  {
    schema: "lock.schema.json",
    page: "docs/reference/lock.md",
    title: "Lock file reference",
    file: "concordance.lock.yaml",
    guide: "../guides/configuration.md#lock",
  },
  {
    schema: "type-module.schema.json",
    page: "docs/reference/type-module.md",
    title: "Type module reference",
    file: "type.yaml",
    guide: "../guides/adding-a-type.md",
  },
];

const SCHEMA_BASE = "https://concordance-wiki.github.io/concordance/schemas/";

/**
 * A schema with the definitions it references in a sibling schema copied under its own `$defs`
 * and the references made local, so that one page renders it: `type-module` refers to the
 * attribute and display definitions of the profile.
 */
export function inlineExternalRefs(schema, readSchema) {
  const defs = { ...(schema.$defs ?? {}) };
  const visit = (node) => {
    if (Array.isArray(node)) return node.map(visit);
    if (!isObject(node)) return node;
    const copy = {};
    for (const [key, value] of Object.entries(node)) {
      if (key === "$ref" && typeof value === "string" && value.startsWith(SCHEMA_BASE)) {
        const [file, fragment] = value.slice(SCHEMA_BASE.length).split("#");
        Object.assign(defs, readSchema(file).$defs);
        copy[key] = `#${fragment}`;
      } else {
        copy[key] = visit(value);
      }
    }
    return copy;
  };
  const inlined = visit(
    Object.fromEntries(Object.entries(schema).filter(([key]) => key !== "$defs")),
  );
  return Object.keys(defs).length === 0 ? inlined : { ...inlined, $defs: visit(defs) };
}

const isObject = (value) => typeof value === "object" && value !== null && !Array.isArray(value);

/** Markdown table cell: pipes escaped, newlines flattened. */
const cell = (text) =>
  String(text)
    .replace(/\|/g, "\\|")
    // A blank run is taken from its first character: retrying inside it would make the runtime quadratic.
    .replace(/(?<!\s)\s*\n\s*/g, " ");
const code = (text) => `\`${cell(text)}\``;

/** The anchor GitHub gives a heading made of one inline code span. */
export function anchorOf(heading) {
  return heading
    .toLowerCase()
    .replace(/[^a-z0-9 _-]/g, "")
    .replace(/ /g, "-");
}

function resolveRef(schema, ref) {
  if (!ref.startsWith("#/")) throw new Error(`external reference ${ref} is not supported`);
  let node = schema;
  for (const segment of ref.slice(2).split("/")) {
    node = node?.[segment];
  }
  if (node === undefined) throw new Error(`unresolved reference ${ref}`);
  return node;
}

/** The node behind a property: its own keywords over those of the definition it references. */
function deref(schema, node) {
  if (!isObject(node) || node.$ref === undefined) return { node, ref: undefined };
  const { $ref, ...own } = node;
  return { node: { ...resolveRef(schema, $ref), ...own }, ref: $ref };
}

/** Whether a node describes an object with named properties, worth a section of its own. */
const hasProperties = (node) => isObject(node) && isObject(node.properties);

/** A schema or its `additionalProperties` value schema, when it is a map. */
const mapValues = (node) =>
  isObject(node?.additionalProperties) ? node.additionalProperties : null;

function typeOf(schema, raw) {
  const { node } = deref(schema, raw);
  if (!isObject(node) || Object.keys(node).length === 0) return "any";
  if (node.const !== undefined) return "constant";
  if (node.enum !== undefined) return "enum";
  if (node.type === undefined && Array.isArray(node.oneOf)) {
    return node.oneOf.map((branch) => typeOf(schema, branch)).join(" \\| ");
  }
  if (node.type === "array") {
    const items = typeOf(schema, node.items ?? {});
    return items.includes("|") ? `(${items})[]` : `${items}[]`;
  }
  if (node.type === "object") {
    if (mapValues(node) !== null) return `map of ${typeOf(schema, node.additionalProperties)}`;
    return "object";
  }
  if (Array.isArray(node.type)) return node.type.join(" \\| ");
  return node.type ?? "any";
}

const plural = (count) => (count === 1 ? "" : "s");

/** The constraints of a node, item and map constraints prefixed, as one cell. */
function allowedOf(schema, raw, prefix = "") {
  const { node } = deref(schema, raw);
  if (!isObject(node)) return [];
  const parts = [];
  if (node.const !== undefined) parts.push(code(JSON.stringify(node.const)));
  if (node.enum !== undefined) parts.push(node.enum.map((value) => code(value)).join(", "));
  if (node.pattern !== undefined) parts.push(`pattern ${code(node.pattern)}`);
  if (node.format !== undefined) parts.push(`format ${code(node.format)}`);
  if (node.minimum !== undefined && node.maximum !== undefined) {
    parts.push(`${String(node.minimum)} to ${String(node.maximum)}`);
  } else if (node.minimum !== undefined) {
    parts.push(`at least ${String(node.minimum)}`);
  } else if (node.maximum !== undefined) {
    parts.push(`at most ${String(node.maximum)}`);
  }
  if (node.minLength !== undefined)
    parts.push(
      node.minLength === 1 ? "non-empty" : `at least ${String(node.minLength)} characters`,
    );
  if (
    node.minItems !== undefined &&
    node.maxItems !== undefined &&
    node.minItems === node.maxItems
  ) {
    parts.push(`exactly ${String(node.minItems)} items`);
  } else {
    if (node.minItems !== undefined)
      parts.push(`at least ${String(node.minItems)} item${plural(node.minItems)}`);
    if (node.maxItems !== undefined)
      parts.push(`at most ${String(node.maxItems)} item${plural(node.maxItems)}`);
  }
  if (node.minProperties !== undefined)
    parts.push(`at least ${String(node.minProperties)} key${plural(node.minProperties)}`);
  const prefixed = parts.map((part) => `${prefix}${part}`);
  if (node.type === "array" && node.items !== undefined) {
    prefixed.push(...allowedOf(schema, node.items, `${prefix}each: `));
  }
  if (isObject(node.propertyNames)) {
    prefixed.push(...allowedOf(schema, node.propertyNames, `${prefix}keys: `));
  }
  if (mapValues(node) !== null && !hasProperties(node.additionalProperties)) {
    prefixed.push(...allowedOf(schema, node.additionalProperties, `${prefix}values: `));
  }
  if (Array.isArray(node.oneOf)) {
    node.oneOf.forEach((branch) => prefixed.push(...allowedOf(schema, branch, prefix)));
  }
  return prefixed;
}

/**
 * The object nodes reachable from a property that deserve a section: the
 * property itself, the items of an array of objects, the values of a map, the
 * object branches of a oneOf. Each comes with the path suffix of its heading.
 */
function nestedObjects(schema, raw, path, inherited) {
  const { node, ref } = deref(schema, raw);
  if (!isObject(node)) return [];
  // A definition keeps its own description; an unnamed items or values object
  // takes the one of the property that holds it.
  const description =
    (ref === undefined ? undefined : resolveRef(schema, ref).description) ??
    node.description ??
    inherited;
  if (hasProperties(node)) return [{ path, node: { ...node, description }, ref }];
  if (node.type === "array" && node.items !== undefined) {
    return nestedObjects(schema, node.items, `${path}[]`, description);
  }
  const values = mapValues(node);
  if (values !== null) return nestedObjects(schema, values, `${path}.*`, description);
  if (Array.isArray(node.oneOf)) {
    return node.oneOf.flatMap((branch) => nestedObjects(schema, branch, path, description));
  }
  return [];
}

/** The `oneOf` constraints of an object, as sentences: which key each branch requires or pins. */
function alternativesOf(node) {
  if (!Array.isArray(node.oneOf)) return [];
  return node.oneOf.map((branch) => {
    const pinned = Object.entries(branch.properties ?? {})
      .filter(([, value]) => isObject(value) && value.const !== undefined)
      .map(([key, value]) => `${code(key)} is ${code(JSON.stringify(value.const))}`);
    const required = (branch.required ?? [])
      .filter((key) => !pinned.some((text) => text.startsWith(code(key))))
      .map((key) => `${code(key)} is set`);
    return [...required, ...pinned].join(" and ");
  });
}

/** The properties left without a description, as dotted paths. */
export function undescribedProperties(schema) {
  const missing = [];
  const seen = new Set();
  const visit = (raw, path) => {
    const { node, ref } = deref(schema, raw);
    if (!isObject(node)) return;
    if (ref !== undefined) {
      if (seen.has(ref)) return;
      seen.add(ref);
    }
    for (const [key, value] of Object.entries(node.properties ?? {})) {
      const child = `${path}${path === "" ? "" : "."}${key}`;
      const resolved = deref(schema, value).node;
      if (
        !isObject(resolved) ||
        typeof resolved.description !== "string" ||
        resolved.description === ""
      ) {
        missing.push(child);
      }
      visit(value, child);
    }
    if (node.type === "array" && node.items !== undefined) visit(node.items, `${path}[]`);
    const values = mapValues(node);
    if (values !== null) visit(values, `${path}.*`);
    if (Array.isArray(node.oneOf)) {
      // A branch only adds a property when the enclosing object does not declare it.
      for (const branch of node.oneOf) {
        const declared = new Set(Object.keys(node.properties ?? {}));
        const own = Object.fromEntries(
          Object.entries(branch.properties ?? {}).filter(([key]) => !declared.has(key)),
        );
        visit({ ...branch, properties: own }, path);
      }
    }
  };
  visit(schema, "");
  return missing;
}

/** The markdown page of one schema. */
export function renderReference(schema, entry) {
  const lines = [];
  const sections = [];
  const rendered = new Map();

  const describe = (raw, path) => {
    const { node } = deref(schema, raw);
    const text = isObject(node) && typeof node.description === "string" ? node.description : "";
    const nested = nestedObjects(schema, raw, path);
    const links = nested.map((target) => {
      const key = target.ref ?? target.path;
      const heading = rendered.get(key) ?? target.path;
      return rendered.has(key) && target.ref !== undefined
        ? `Same shape as [${code(heading)}](#${anchorOf(heading)}).`
        : `See [${code(heading)}](#${anchorOf(heading)}).`;
    });
    return [text, ...links].filter((part) => part !== "").join(" ");
  };

  const section = (node, path, ref, level) => {
    const key = ref ?? path;
    if (rendered.has(key)) return;
    rendered.set(key, path);
    const required = new Set(node.required ?? []);
    const body = [];
    body.push(`${"#".repeat(level)} ${code(path)}`, "");
    if (typeof node.description === "string" && path !== "") body.push(node.description, "");
    const alternatives = alternativesOf(node);
    if (alternatives.length > 0) {
      body.push(`Exactly one of: ${alternatives.join("; ")}.`, "");
    }
    if (isObject(node.propertyNames)) {
      const constraints = allowedOf(schema, node.propertyNames);
      if (constraints.length > 0) body.push(`Keys: ${constraints.join(", ")}.`, "");
    }
    body.push("| Key | Type | Default | Allowed values | Description |", "|---|---|---|---|---|");
    const children = [];
    for (const [name, value] of Object.entries(node.properties ?? {})) {
      const resolved = deref(schema, value).node;
      const defaultValue =
        isObject(resolved) && resolved.default !== undefined
          ? code(JSON.stringify(resolved.default))
          : "—";
      const allowed = allowedOf(schema, value);
      body.push(
        `| ${code(name)}${required.has(name) ? " (required)" : ""} | ${typeOf(schema, value)} | ${defaultValue} | ${
          allowed.length > 0 ? allowed.join("; ") : "—"
        } | ${cell(describe(value, `${path === "" ? "" : `${path}.`}${name}`))} |`,
      );
      children.push(...nestedObjects(schema, value, `${path === "" ? "" : `${path}.`}${name}`));
    }
    const values = mapValues(node);
    if (values !== null) {
      children.push(...nestedObjects(schema, values, `${path}.*`));
    }
    body.push("");
    sections.push(body.join("\n"));
    for (const child of children) section(child.node, child.path, child.ref, path === "" ? 2 : 3);
  };

  lines.push(`# ${entry.title}`, "");
  lines.push(
    `Every key of \`${entry.file}\`, generated from [\`${entry.schema}\`](../../packages/core/schemas/${entry.schema}) by \`scripts/config-reference.mjs\`: edit the schema, then run \`pnpm reference:update\`. The [guide](${entry.guide}) explains how the keys work together.`,
    "",
  );
  if (typeof schema.description === "string") lines.push(schema.description, "");
  lines.push(
    "A key marked (required) must be present; every other key is optional and takes the default shown, or none. Paths use `[]` for the items of a list and `*` for the keys of a map.",
    "",
  );
  section(schema, "", undefined, 2);
  // The root section is titled after the file rather than an empty path.
  sections[0] = sections[0].replace(/^## ``$/m, "## Top-level keys");
  lines.push(...sections);
  return `${lines.join("\n").trimEnd()}\n`;
}

/** Every page with its content, from the schemas under `root`. */
export function generateReference(root) {
  const readSchema = (name) =>
    JSON.parse(readFileSync(join(root, "packages/core/schemas", name), "utf8"));
  return referencePages.map((entry) => {
    const schema = inlineExternalRefs(readSchema(entry.schema), readSchema);
    return {
      ...entry,
      content: renderReference(schema, entry),
      missing: undescribedProperties(schema),
    };
  });
}

if (process.argv[1] !== undefined && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
  for (const page of generateReference(root)) {
    mkdirSync(dirname(join(root, page.page)), { recursive: true });
    writeFileSync(join(root, page.page), page.content);
    console.log(`${page.page}: written from ${page.schema}`);
    for (const path of page.missing) console.error(`${page.schema}: ${path} has no description`);
  }
}
