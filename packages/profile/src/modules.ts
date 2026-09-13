import { fileURLToPath } from "node:url";

import { readSchema, type ConfigIssue, type FileSystem } from "@concordance-wiki/core";
import { Ajv2020, type ErrorObject, type ValidateFunction } from "ajv/dist/2020.js";
import { parse, type YAMLParseError } from "yaml";

import { describeErrors } from "./issues.js";
import type {
  AttributeDefinition,
  DisplayDefinition,
  Label,
  ProfileStatus,
  SectionDefinition,
  TypeDefinition,
} from "./types.js";

/** The folder of the type modules the default profile is assembled from, without a trailing slash. */
export function defaultTypesDirectory(): string {
  return fileURLToPath(new URL("../types", import.meta.url));
}

/** The source language of the messages, whose catalogue every module ships. */
export const MODULE_SOURCE_LANGUAGE = "en";

export const MODULE_DECLARATION_FILE = "type.yaml";
export const MODULE_TEMPLATE_FILE = "template.md";
export const MODULE_SCHEMA_FILE = "schema.json";
export const MODULE_MESSAGES_FOLDER = "messages";
export const MODULE_COMPONENTS_FOLDER = "components";

/** A mapped section of a module: the section of the profile without its heading, which the messages carry. */
export type TypeModuleSection = Omit<SectionDefinition, "heading">;

/** What `type.yaml` declares: the type of the profile without its labels. */
export interface TypeModuleDeclaration {
  group: string;
  status?: ProfileStatus;
  glyph?: string;
  graph?: "full" | "documents-only";
  attributes?: Record<string, AttributeDefinition>;
  sections?: Record<string, TypeModuleSection>;
  display?: DisplayDefinition;
}

/** The messages of a module in one locale: `label`, `attributes.<name>` and `sections.<key>`, as final strings. */
export type TypeMessages = Readonly<Record<string, string>>;

/** The component names a module may override: the page of the type, the value of an attribute, a mapped section. */
export const MODULE_COMPONENT_PATTERN =
  /^(EntityPage|Attribute@[a-z][a-z0-9_]*|Section@[a-z][a-z0-9_]*)$/;

export interface TypeModule {
  /** The type the module declares: the name of its folder. */
  slug: string;
  /** Absolute folder of the module. */
  directory: string;
  /** The plugin the module comes from, set by the command line; absent for a module of a project folder. */
  origin?: string;
  declaration: TypeModuleDeclaration;
  /** By language; the source language is always present. */
  messages: Readonly<Record<string, TypeMessages>>;
  /** The note template, when the module ships one. */
  template?: string;
  /** JSON Schema of the items of the `list` attributes, by attribute name, when the module ships one. */
  schema?: Readonly<Record<string, unknown>>;
  /** Component overrides by name, `EntityPage`, `Attribute@<name>` or `Section@<key>`, as absolute paths of their modules. */
  components: Readonly<Record<string, string>>;
}

export type TypeModuleReading =
  { ok: true; module: TypeModule; issues: ConfigIssue[] } | { ok: false; issues: ConfigIssue[] };

const SLUG_PATTERN = /^[a-z][a-z0-9_]*$/;
const MESSAGES_FILE_PATTERN = /^messages\/([a-z]{2,3})\.json$/;

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function error(path: string, message: string, detail: Partial<ConfigIssue> = {}): ConfigIssue {
  return { severity: "error", path, message, ...detail };
}

function slugOf(directory: string): string {
  const trimmed = directory.replace(/[\\/]+$/, "");
  return trimmed.slice(Math.max(trimmed.lastIndexOf("/"), trimmed.lastIndexOf("\\")) + 1);
}

/** Compiles the published schema with the profile schema it refers to; a module is read once per build. */
function validator(): ValidateFunction<TypeModuleDeclaration> {
  const ajv = new Ajv2020({ allErrors: true, allowUnionTypes: true, strict: true });
  ajv.addSchema(readSchema("profile"));
  return ajv.compile<TypeModuleDeclaration>(readSchema("type-module"));
}

function prefixed(file: string, issue: ConfigIssue): ConfigIssue {
  return { ...issue, path: issue.path === "" ? file : `${file}: ${issue.path}` };
}

type Parsed = { ok: true; document: unknown } | { ok: false; issue: ConfigIssue };

function parseYamlFile(text: string): Parsed {
  try {
    return { ok: true, document: parse(text) };
  } catch (caught) {
    // The parser only throws YAMLParseError instances.
    const detail = (caught as YAMLParseError).message.split("\n", 1).join("");
    return { ok: false, issue: error("", `not valid YAML: ${detail}`) };
  }
}

function parseJsonFile(text: string): Parsed {
  try {
    return { ok: true, document: JSON.parse(text) };
  } catch (caught) {
    return { ok: false, issue: error("", `not valid JSON: ${(caught as SyntaxError).message}`) };
  }
}

function declarationOf(
  text: string,
): { ok: true; declaration: TypeModuleDeclaration } | { ok: false; issues: ConfigIssue[] } {
  const parsed = parseYamlFile(text);
  if (!parsed.ok) {
    return { ok: false, issues: [prefixed(MODULE_DECLARATION_FILE, parsed.issue)] };
  }
  const validate = validator();
  if (validate(parsed.document)) {
    return { ok: true, declaration: parsed.document };
  }
  // The validator fills `errors` whenever it returns false.
  const errors = validate.errors as ErrorObject[];
  return {
    ok: false,
    issues: describeErrors(errors, parsed.document).map((issue) =>
      prefixed(MODULE_DECLARATION_FILE, issue),
    ),
  };
}

/** A message is a final string, or the source form `{ defaultMessage, description }` of the interface catalogues. */
function messageOf(value: unknown): string | undefined {
  if (typeof value === "string") return value;
  if (isPlainObject(value) && typeof value["defaultMessage"] === "string") {
    return value["defaultMessage"];
  }
  return undefined;
}

function messagesOf(
  file: string,
  text: string,
  declaration: TypeModuleDeclaration,
): { messages: TypeMessages; issues: ConfigIssue[] } {
  const parsed = parseJsonFile(text);
  if (!parsed.ok) {
    return { messages: {}, issues: [prefixed(file, parsed.issue)] };
  }
  if (!isPlainObject(parsed.document)) {
    return {
      messages: {},
      issues: [
        prefixed(file, error("", "wrong type", { received: parsed.document, expected: "object" })),
      ],
    };
  }
  const issues: ConfigIssue[] = [];
  const messages: Record<string, string> = {};
  const attributes = Object.keys(declaration.attributes ?? {});
  const sections = Object.keys(declaration.sections ?? {});
  for (const key of Object.keys(parsed.document).sort()) {
    const message = messageOf(parsed.document[key]);
    if (message === undefined) {
      issues.push(
        prefixed(
          file,
          error(key, "not a message", {
            received: parsed.document[key],
            expected: "a string, or { defaultMessage, description }",
          }),
        ),
      );
      continue;
    }
    const [kind, name] = key.split(".", 2);
    const known =
      key === "label" ||
      (kind === "attributes" && name !== undefined && attributes.includes(name)) ||
      (kind === "sections" && name !== undefined && sections.includes(name));
    if (!known) {
      issues.push(
        prefixed(
          file,
          error(key, "message names nothing the module declares", {
            expected: "label, attributes.<declared attribute> or sections.<declared section>",
          }),
        ),
      );
      continue;
    }
    messages[key] = message;
  }
  return { messages, issues };
}

function schemaOf(
  text: string,
  declaration: TypeModuleDeclaration,
): { schema?: Record<string, unknown>; issues: ConfigIssue[] } {
  const parsed = parseJsonFile(text);
  if (!parsed.ok) {
    return { issues: [prefixed(MODULE_SCHEMA_FILE, parsed.issue)] };
  }
  if (!isPlainObject(parsed.document)) {
    return {
      issues: [
        prefixed(
          MODULE_SCHEMA_FILE,
          error("", "wrong type", { received: parsed.document, expected: "object" }),
        ),
      ],
    };
  }
  const issues: ConfigIssue[] = [];
  for (const name of Object.keys(parsed.document).sort()) {
    if (declaration.attributes?.[name]?.type !== "list") {
      issues.push(
        prefixed(
          MODULE_SCHEMA_FILE,
          error(name, "not a list attribute of the type", {
            expected: "the name of an attribute declared with type list",
          }),
        ),
      );
    }
  }
  return { schema: parsed.document, issues };
}

function componentsOf(files: readonly string[]): {
  components: Record<string, string>;
  issues: ConfigIssue[];
} {
  const components: Record<string, string> = {};
  const issues: ConfigIssue[] = [];
  for (const file of files) {
    const name = file.replace(/\.[^.]+$/, "");
    if (!MODULE_COMPONENT_PATTERN.test(name) || file.includes("/")) {
      issues.push(
        error(`${MODULE_COMPONENTS_FOLDER}/${file}`, "not a component a module may provide", {
          expected:
            "EntityPage, Attribute@<attribute> or Section@<section>, as a single module file",
        }),
      );
      continue;
    }
    components[name] = file;
  }
  return { components, issues };
}

/**
 * Reads one module folder: `type.yaml` against the published schema, every message file, the
 * template, the schema and the components. Every problem is reported at once, with the file it
 * comes from; the slug is the folder name.
 */
export function readTypeModule(fs: FileSystem, directory: string): TypeModuleReading {
  const root = directory.replace(/[\\/]+$/, "");
  const slug = slugOf(root);
  const at = (file: string): string => `${root}/${file}`;
  if (!SLUG_PATTERN.test(slug)) {
    return {
      ok: false,
      issues: [
        error("", "folder name is not a type slug", {
          received: slug,
          expected: "lowercase letters, digits and underscores, starting with a letter",
        }),
      ],
    };
  }
  if (!fs.exists(at(MODULE_DECLARATION_FILE))) {
    return { ok: false, issues: [error(MODULE_DECLARATION_FILE, "file not found")] };
  }
  const declared = declarationOf(fs.readText(at(MODULE_DECLARATION_FILE)));
  if (!declared.ok) {
    return declared;
  }
  const { declaration } = declared;
  const issues: ConfigIssue[] = [];
  const messages: Record<string, TypeMessages> = {};
  const files = fs.listFiles(root);
  for (const file of files) {
    const language = MESSAGES_FILE_PATTERN.exec(file)?.[1];
    if (language === undefined) continue;
    const read = messagesOf(file, fs.readText(at(file)), declaration);
    issues.push(...read.issues);
    messages[language] = read.messages;
  }
  const source = messages[MODULE_SOURCE_LANGUAGE];
  if (source === undefined) {
    issues.push(
      error(`${MODULE_MESSAGES_FOLDER}/${MODULE_SOURCE_LANGUAGE}.json`, "file not found"),
    );
  } else {
    if (source["label"] === undefined) {
      issues.push(
        error(
          `${MODULE_MESSAGES_FOLDER}/${MODULE_SOURCE_LANGUAGE}.json: label`,
          "required message is missing",
        ),
      );
    }
    for (const key of Object.keys(declaration.sections ?? {})) {
      if (source[`sections.${key}`] === undefined) {
        issues.push(
          error(
            `${MODULE_MESSAGES_FOLDER}/${MODULE_SOURCE_LANGUAGE}.json: sections.${key}`,
            "required message is missing",
          ),
        );
      }
    }
  }
  let schema: Record<string, unknown> | undefined;
  if (files.includes(MODULE_SCHEMA_FILE)) {
    const read = schemaOf(fs.readText(at(MODULE_SCHEMA_FILE)), declaration);
    issues.push(...read.issues);
    schema = read.schema;
  }
  const componentFiles = files
    .filter((file) => file.startsWith(`${MODULE_COMPONENTS_FOLDER}/`))
    .map((file) => file.slice(MODULE_COMPONENTS_FOLDER.length + 1));
  const read = componentsOf(componentFiles);
  issues.push(...read.issues);
  if (issues.length > 0) {
    return { ok: false, issues };
  }
  const components: Record<string, string> = {};
  for (const [name, file] of Object.entries(read.components)) {
    components[name] = at(`${MODULE_COMPONENTS_FOLDER}/${file}`);
  }
  const module: TypeModule = {
    slug,
    directory: root,
    declaration,
    messages,
    ...(files.includes(MODULE_TEMPLATE_FILE)
      ? { template: fs.readText(at(MODULE_TEMPLATE_FILE)) }
      : {}),
    ...(schema === undefined ? {} : { schema }),
    components,
  };
  return { ok: true, module, issues: [] };
}

export interface TypeModulesReading {
  /** The modules read without a problem, by slug order. */
  modules: TypeModule[];
  /** The problems of the others, each path starting with the module folder. */
  issues: ConfigIssue[];
}

/** Reads every module of a folder: each direct sub-folder holding a `type.yaml`, in slug order. */
export function readTypeModules(fs: FileSystem, directory: string): TypeModulesReading {
  const root = directory.replace(/[\\/]+$/, "");
  const slugs = new Set<string>();
  for (const file of fs.listFiles(root)) {
    const parts = file.split("/");
    if (parts.length === 2 && parts[1] === MODULE_DECLARATION_FILE && parts[0] !== undefined) {
      slugs.add(parts[0]);
    }
  }
  const modules: TypeModule[] = [];
  const issues: ConfigIssue[] = [];
  for (const slug of [...slugs].sort()) {
    const reading = readTypeModule(fs, `${root}/${slug}`);
    if (reading.ok) {
      modules.push(reading.module);
    } else {
      issues.push(...reading.issues.map((issue) => prefixed(slug, issue)));
    }
  }
  return { modules, issues };
}

/** The label of a message in every language of the module that carries it; the source language is always there. */
function labelOf(module: TypeModule, key: string): Label | undefined {
  const source = module.messages[MODULE_SOURCE_LANGUAGE]?.[key];
  if (source === undefined) return undefined;
  const label: Label = { en: source };
  const french = module.messages["fr"]?.[key];
  if (french !== undefined) label.fr = french;
  return label;
}

/**
 * The type definition of the profile a module stands for: its declaration, the labels of its
 * messages and, for a `list` attribute the module's schema describes, that schema.
 */
export function typeDefinitionOf(module: TypeModule): TypeDefinition {
  const { declaration } = module;
  const attributes: Record<string, AttributeDefinition> = {};
  for (const [name, attribute] of Object.entries(declaration.attributes ?? {})) {
    const label = labelOf(module, `attributes.${name}`);
    const schema = module.schema?.[name];
    attributes[name] = {
      ...attribute,
      ...(label === undefined ? {} : { label }),
      ...(attribute.schema === undefined && isPlainObject(schema) ? { schema } : {}),
    };
  }
  const sections: Record<string, SectionDefinition> = {};
  for (const [key, section] of Object.entries(declaration.sections ?? {})) {
    // A module is read with every section message present; the source label is there.
    const heading = labelOf(module, `sections.${key}`) as Label;
    sections[key] = { heading, ...section };
  }
  return {
    // Same reason: the label message is checked when the module is read.
    label: labelOf(module, "label") as Label,
    group: declaration.group,
    ...(declaration.status === undefined ? {} : { status: declaration.status }),
    ...(declaration.glyph === undefined ? {} : { glyph: declaration.glyph }),
    ...(declaration.graph === undefined ? {} : { graph: declaration.graph }),
    ...(declaration.attributes === undefined ? {} : { attributes }),
    ...(declaration.sections === undefined ? {} : { sections }),
    ...(declaration.display === undefined ? {} : { display: declaration.display }),
  };
}

/** The `types` block a list of modules assembles into, by slug order. */
export function typesOf(modules: readonly TypeModule[]): Record<string, TypeDefinition> {
  const types: Record<string, TypeDefinition> = {};
  for (const module of [...modules].sort((a, b) =>
    a.slug < b.slug ? -1 : a.slug > b.slug ? 1 : 0,
  )) {
    types[module.slug] = typeDefinitionOf(module);
  }
  return types;
}
