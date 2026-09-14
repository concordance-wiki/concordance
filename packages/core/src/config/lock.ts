import { Ajv2020, type ErrorObject, type ValidateFunction } from "ajv/dist/2020.js";

import { readSchema } from "./schema.js";
import type { LockFile, LockValidation } from "./types.js";
import { describeSchemaError } from "./validate.js";

/** The `date` format of the schema: the day of a decision, `YYYY-MM-DD`. */
const date = /^\d{4}-\d{2}-\d{2}$/;

/** Compiles the published schema; the lock file is read once per build, so nothing is cached. */
function validator(): ValidateFunction<LockFile> {
  const ajv = new Ajv2020({ allErrors: true, allowUnionTypes: true, strict: true });
  ajv.addFormat("date", (value) => date.test(value));
  return ajv.compile<LockFile>(readSchema("lock"));
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
