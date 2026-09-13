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

/** Read at the root of the linted repository; carries the `checks:` overrides and the `global:` settings. */
export const LINT_CONFIG_FILE = "concordance-lint.yaml";

/** Where the global scope keeps the published model between two runs, relative to the repository root. */
export const DEFAULT_CACHE_DIR = ".concordance-cache/lint";

/** How long a cached model is reused without any request, in hours. */
export const DEFAULT_MAX_AGE_HOURS = 24;

/** A faulty `concordance-lint.yaml`: the linter cannot run, so this is an execution error, never a finding. */
export class LintConfigError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "LintConfigError";
  }
}

/** The `global:` block: where the published model comes from and how long its copy lives. */
export interface GlobalLintConfig {
  /** URL (`https://…/model.json`) or path relative to the repository root of the published model. */
  model?: string;
  /** Folder of the cached model, relative to the repository root; `DEFAULT_CACHE_DIR` by default. */
  cache_dir?: string;
  /** Hours during which the cached model is reused without a request; `DEFAULT_MAX_AGE_HOURS` by default. */
  max_age_hours?: number;
  /** Path of a project profile, relative to the repository root; the default profile applies without it. */
  profile?: string;
}

/** What `concordance-lint.yaml` holds once validated; `checks` is always present, empty when the file says nothing. */
export interface LintOverrides {
  checks: CheckOverrides;
  global?: GlobalLintConfig;
}

export type LintConfigValidation =
  | { ok: true; checks: CheckOverrides; global?: GlobalLintConfig }
  | { ok: false; issues: ConfigIssue[] };

interface LintConfig {
  checks?: CheckOverrides;
  global?: GlobalLintConfig;
}

const globalSchema: AnySchema = {
  type: "object",
  additionalProperties: false,
  properties: {
    model: { type: "string", minLength: 1 },
    cache_dir: { type: "string", minLength: 1 },
    max_age_hours: { type: "number", minimum: 0 },
    profile: { type: "string", minLength: 1 },
  },
};

/** Compiles the `checks` block of the published configuration schema; validation runs once per lint, so nothing is cached. */
function validator(): ValidateFunction<LintConfig> {
  // The published configuration schema declares `checks` under `properties`; the lint file reuses that block.
  const config = readSchema("config") as { properties: { checks: AnySchema } };
  const ajv = new Ajv2020({ allErrors: true, allowUnionTypes: true, strict: true });
  return ajv.compile<LintConfig>({
    type: "object",
    additionalProperties: false,
    properties: { checks: config.properties.checks, global: globalSchema },
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
  const checks = candidate.checks ?? {};
  return candidate.global === undefined
    ? { ok: true, checks }
    : { ok: true, checks, global: candidate.global };
}

/** The content of `<root>/concordance-lint.yaml`; nothing when the file is absent, an error when it is faulty. */
export function readLintConfig(fs: FileSystem, root: string): LintOverrides {
  const file = posix.join(root, LINT_CONFIG_FILE);
  if (!fs.exists(file)) {
    return { checks: {} };
  }
  const validation = parseLintConfig(fs.readText(file));
  if (!validation.ok) {
    throw new LintConfigError(
      validation.issues.map((issue) => formatIssue(issue, file)).join("\n"),
    );
  }
  const { checks, global } = validation;
  return global === undefined ? { checks } : { checks, global };
}

/** The `checks` overrides of `<root>/concordance-lint.yaml` alone. */
export function readLintOverrides(fs: FileSystem, root: string): CheckOverrides {
  return readLintConfig(fs, root).checks;
}
