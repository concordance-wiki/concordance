import { describeSchemaError } from "@concordance-wiki/core";
import type { ErrorObject } from "ajv/dist/2020.js";

import type { ProfileIssue } from "./types.js";

/**
 * Errors raised inside a oneOf branch describe the branch, not the document; the propertyNames
 * error only repeats the error raised on the key itself.
 */
export function isRedundant(error: ErrorObject): boolean {
  return /\/oneOf\/\d+\//.test(error.schemaPath) || error.keyword === "propertyNames";
}

/** The issue of a schema error, a faulty key named at its own path rather than at its object. */
export function describeError(error: ErrorObject, document: unknown): ProfileIssue {
  const issue = describeSchemaError(error, document);
  if (error.propertyName === undefined) {
    return issue;
  }
  // The validator reports a faulty key at its object, never at the root; name the key instead.
  const path = `${issue.path}.${error.propertyName}`;
  return { ...issue, path, message: "key is not allowed", received: error.propertyName };
}

/** Every issue of a failed validation, the redundant errors left out. */
export function describeErrors(errors: readonly ErrorObject[], document: unknown): ProfileIssue[] {
  return errors
    .filter((error) => !isRedundant(error))
    .map((error) => describeError(error, document));
}
