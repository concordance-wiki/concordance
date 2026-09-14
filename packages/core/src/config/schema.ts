import { readFileSync } from "node:fs";

import type { AnySchema } from "ajv";

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

export function readSchema(name: SchemaName): AnySchema {
  const url = new URL(`${name}.schema.json`, schemaDirectory);
  return JSON.parse(readFileSync(url, "utf8")) as AnySchema;
}
