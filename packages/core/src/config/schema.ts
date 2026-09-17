import { readFileSync } from "node:fs";

import type { AnySchema } from "ajv";
import { Ajv2020, type ValidateFunction } from "ajv/dist/2020.js";

const schemaDirectory = new URL("../../schemas/", import.meta.url);

export type SchemaName =
  | "config"
  | "lint"
  | "profile"
  | "type-module"
  | "model"
  | "lock"
  | "theme"
  | "plugin"
  | "language-pack"
  | "pseudonyms";

/** The schemas a schema refers to, registered before it compiles. */
const REFERENCES: Partial<Record<SchemaName, readonly SchemaName[]>> = {
  lint: ["config"],
  "type-module": ["profile"],
};

const DATE = /^\d{4}-\d{2}-\d{2}$/;
const DATE_TIME = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d+)?(Z|[+-]\d{2}:\d{2})$/;

const schemas = new Map<SchemaName, AnySchema>();
const validators = new Map<SchemaName, ValidateFunction>();

/** The published schema of a name, read once: the schemas of the package never change while it runs. */
export function readSchema(name: SchemaName): AnySchema {
  const known = schemas.get(name);
  if (known !== undefined) return known;
  const url = new URL(`${name}.schema.json`, schemaDirectory);
  const schema = JSON.parse(readFileSync(url, "utf8")) as AnySchema;
  schemas.set(name, schema);
  return schema;
}

/**
 * The validator of a published schema, compiled once per process and shared: a command
 * validates dozens of documents against the same few schemas, and compiling one costs more
 * than validating a hundred. Every schema is compiled with the same options and the three
 * formats the schemas use (`date`, `date-time`, `uri`), the core shipping no format library.
 * The validator keeps its `errors` from the last call, as any Ajv validator does.
 */
export function compiledSchema<T = unknown>(name: SchemaName): ValidateFunction<T> {
  const known = validators.get(name);
  // One map for every schema: the validator of a name is the one compiled for that name's type.
  if (known !== undefined) return known as ValidateFunction<T>;
  const ajv = new Ajv2020({ allErrors: true, allowUnionTypes: true, strict: true });
  ajv.addFormat("date", (value) => DATE.test(value));
  ajv.addFormat("date-time", (value) => DATE_TIME.test(value));
  ajv.addFormat("uri", (value) => URL.canParse(value));
  for (const reference of REFERENCES[name] ?? []) ajv.addSchema(readSchema(reference));
  const validate = ajv.compile<T>(readSchema(name));
  validators.set(name, validate);
  return validate;
}
