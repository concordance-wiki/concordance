import { posix } from "node:path";

import {
  describeSchemaError,
  formatIssue,
  readSchema,
  type CheckOverrides,
  type ConfigIssue,
  type FileSystem,
} from "@concordance-wiki/core";
import { Ajv2020, type AnySchema, type ErrorObject, type ValidateFunction } from "ajv/dist/2020.js";
import { parse, type YAMLParseError } from "yaml";

/** Read at the root of the linted repository; carries the `checks:` block alone. */
export const LINT_CONFIG_FILE = "concordance-lint.yaml";

/** A faulty `concordance-lint.yaml`: the linter cannot run, so this is an execution error, never a finding. */
export class LintConfigError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "LintConfigError";
  }
}

export type LintConfigValidation =
  { ok: true; checks: CheckOverrides } | { ok: false; issues: ConfigIssue[] };

interface LintConfig {
  checks?: CheckOverrides;
}

/** Compiles the `checks` block of the published configuration schema; validation runs once per lint, so nothing is cached. */
function validator(): ValidateFunction<LintConfig> {
  // The published configuration schema declares `checks` under `properties`; the lint file reuses that block.
  const config = readSchema("config") as { properties: { checks: AnySchema } };
  const ajv = new Ajv2020({ allErrors: true, allowUnionTypes: true, strict: true });
  return ajv.compile<LintConfig>({
    type: "object",
    additionalProperties: false,
    properties: { checks: config.properties.checks },
  });
}

function describe(error: ErrorObject, document: unknown): ConfigIssue {
  const issue = describeSchemaError(error, document);
  if (error.propertyName === undefined) {
    return issue;
  }
  // The validator reports a faulty key at its object; name the key instead.
  return {
    severity: "error",
    path: `${issue.path}.${error.propertyName}`,
    message: "key is not a check identifier",
    received: error.propertyName,
  };
}

export function parseLintConfig(text: string): LintConfigValidation {
  let document: unknown;
  try {
    document = parse(text);
  } catch (error) {
    // The parser only throws YAMLParseError instances.
    const detail = (error as YAMLParseError).message.split("\n", 1).join("");
    return {
      ok: false,
      issues: [{ severity: "error", path: "", message: `not valid YAML: ${detail}` }],
    };
  }
  // An empty file overrides nothing.
  const candidate: unknown = document ?? {};
  const validate = validator();
  if (!validate(candidate)) {
    // The validator fills `errors` whenever it returns false; the propertyNames error only repeats the key's own.
    const errors = (validate.errors as ErrorObject[]).filter(
      (error) => error.keyword !== "propertyNames",
    );
    return { ok: false, issues: errors.map((error) => describe(error, candidate)) };
  }
  return { ok: true, checks: candidate.checks ?? {} };
}

/** The overrides of `<root>/concordance-lint.yaml`; none when the file is absent, an error when it is faulty. */
export function readLintOverrides(fs: FileSystem, root: string): CheckOverrides {
  const file = posix.join(root, LINT_CONFIG_FILE);
  if (!fs.exists(file)) {
    return {};
  }
  const validation = parseLintConfig(fs.readText(file));
  if (!validation.ok) {
    throw new LintConfigError(
      validation.issues.map((issue) => formatIssue(issue, file)).join("\n"),
    );
  }
  return validation.checks;
}
