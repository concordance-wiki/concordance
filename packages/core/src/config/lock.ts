import type { ErrorObject, ValidateFunction } from "ajv/dist/2020.js";

import { compiledSchema } from "./schema.js";
import type { LockFile, LockValidation } from "./types.js";
import { describeSchemaError } from "./validate.js";

/** The `date` format of the schema: the day of a decision, `YYYY-MM-DD`. */

/** The validator of the published schema, compiled once per process and shared. */
function validator(): ValidateFunction<LockFile> {
  return compiledSchema<LockFile>("lock");
}

/** Validates a `concordance.lock.yaml` document against the published lock schema; issues name the faulty key. */
export function validateLock(document: unknown): LockValidation {
  const validate = validator();
  if (validate(document)) {
    return { ok: true, lock: document, issues: [] };
  }
  // The validator fills `errors` whenever it returns false.
  const issues = (validate.errors as ErrorObject[]).map((error) =>
    describeSchemaError(error, document),
  );
  return { ok: false, issues };
}
