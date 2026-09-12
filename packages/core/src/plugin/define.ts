import { Ajv2020, type ErrorObject, type ValidateFunction } from "ajv/dist/2020.js";

import { formatIssue } from "../config/report.js";
import { readSchema } from "../config/schema.js";
import type { ConfigIssue } from "../config/types.js";
import { describeSchemaError } from "../config/validate.js";
import type { PluginManifest } from "./api.js";

// A global symbol, so that a plugin built against another copy of the core is still recognised.
const brand = Symbol.for("concordance-wiki.plugin");

export class PluginDefinitionError extends Error {
  readonly issues: ConfigIssue[];

  constructor(label: string, issues: ConfigIssue[]) {
    super(
      ["invalid plugin manifest", ...issues.map((issue) => formatIssue(issue, label))].join("\n"),
    );
    this.name = "PluginDefinitionError";
    this.issues = issues;
  }
}

/** Compiles the published schema; a plugin is defined once per process, so nothing is cached. */
function validator(): ValidateFunction {
  const ajv = new Ajv2020({ allErrors: true, strict: true });
  // The core ships no format library; the documentation URL is checked by the platform parser.
  ajv.addFormat("uri", (value) => URL.canParse(value));
  return ajv.compile(readSchema("plugin"));
}

function labelOf(document: unknown): string {
  // The manifest is an object by construction; its name is read leniently since it may be the invalid part.
  const { name } = document as { name?: unknown };
  return typeof name === "string" ? name : "plugin";
}

export function definePlugin(manifest: PluginManifest): PluginManifest {
  // The schema describes the serialisable side of a manifest: the round trip drops the functions.
  const document: unknown = JSON.parse(JSON.stringify(manifest));
  const validate = validator();
  if (!validate(document)) {
    // The validator fills `errors` whenever it returns false.
    const issues = (validate.errors as ErrorObject[]).map((error) =>
      describeSchemaError(error, document),
    );
    throw new PluginDefinitionError(labelOf(document), issues);
  }
  Object.defineProperty(manifest, brand, { value: true, enumerable: false });
  return manifest;
}

export function isPluginManifest(value: unknown): value is PluginManifest {
  return (
    typeof value === "object" &&
    value !== null &&
    // Reading the brand of an arbitrary object is safe: the property is either the marker or absent.
    (value as Record<symbol, unknown>)[brand] === true
  );
}
