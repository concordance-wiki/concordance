import { Ajv2020, type ErrorObject, type ValidateFunction } from "ajv/dist/2020.js";

import { formatIssue } from "../../config/report.js";
import { readSchema } from "../../config/schema.js";
import type { ConfigIssue } from "../../config/types.js";
import { describeSchemaError } from "../../config/validate.js";
import { canonicalJson } from "./json.js";
import type { CanonicalModel } from "./types.js";

/** What a model text failed on: the JSON itself, or the schema; one issue per schema error. */
export class ModelError extends Error {
  readonly file: string;
  readonly issues: readonly ConfigIssue[];

  constructor(file: string, issues: readonly ConfigIssue[]) {
    super(issues.map((issue) => formatIssue(issue, file)).join("\n"));
    this.name = "ModelError";
    this.file = file;
    this.issues = issues;
  }
}

/** The `date-time` format of the schema: an ISO 8601 instant with an offset, as the clock writes it. */
const dateTime = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d+)?(Z|[+-]\d{2}:\d{2})$/;

/** Compiles the published schema; a model is parsed once per command, so nothing is cached. */
function validator(): ValidateFunction<CanonicalModel> {
  const ajv = new Ajv2020({ allErrors: true, strict: true });
  ajv.addFormat("date-time", (value) => dateTime.test(value));
  return ajv.compile<CanonicalModel>(readSchema("model"));
}

/** Canonical JSON of the model: keys sorted at every depth, two-space indentation, trailing newline. */
export function serializeModel(model: CanonicalModel): string {
  return canonicalJson(model);
}

type Checked = { ok: true; model: CanonicalModel } | { ok: false; issues: ConfigIssue[] };

function check(document: unknown): Checked {
  const validate = validator();
  if (validate(document)) {
    return { ok: true, model: document };
  }
  // The validator fills `errors` whenever it returns false.
  const errors = validate.errors as ErrorObject[];
  return { ok: false, issues: errors.map((error) => describeSchemaError(error, document)) };
}

/** Every departure from `schemas/model.schema.json`, described the same way as configuration errors. */
export function validateModel(document: unknown): ConfigIssue[] {
  const checked = check(document);
  return checked.ok ? [] : checked.issues;
}

/** Reads a model text back, refusing anything the schema does not describe. */
export function parseModel(text: string, file = "model.json"): CanonicalModel {
  let document: unknown;
  try {
    document = JSON.parse(text);
  } catch (error) {
    // JSON.parse only throws SyntaxError instances.
    const detail = (error as SyntaxError).message;
    throw new ModelError(file, [
      { severity: "error", path: "", message: `not valid JSON: ${detail}` },
    ]);
  }
  const checked = check(document);
  if (checked.ok) {
    return checked.model;
  }
  throw new ModelError(file, checked.issues);
}
