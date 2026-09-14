import { posix } from "node:path";

import { Ajv2020, type ErrorObject, type ValidateFunction } from "ajv/dist/2020.js";
import { parse, type YAMLParseError } from "yaml";

import type { FileSystem } from "../io/file-system.js";
import { formatIssue } from "./report.js";
import { readSchema } from "./schema.js";
import type { CheckOverrides, ConfigIssue } from "./types.js";
import { describeSchemaError } from "./validate.js";

/** Read at the root of a knowledge repository by the linter, and by the build that reads the repository as a source. */
export const LINT_CONFIG_FILE = "concordance-lint.yaml";

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
  /** Folder of the cached model, relative to the repository root. */
  cache_dir?: string;
  /** Hours during which the cached model is reused without a request. */
  max_age_hours?: number;
  /** Path of a project profile, relative to the repository root; the default profile applies without it. */
  profile?: string;
}

/** What `concordance-lint.yaml` holds once validated; `checks` is always present, empty when the file says nothing. */
export interface LintOverrides {
  checks: CheckOverrides;
  global?: GlobalLintConfig;
  /** Globs, relative to the repository root, of the files never read, counted or reported. */
  exclude?: string[];
}

export type LintConfigValidation =
  ({ ok: true } & LintOverrides) | { ok: false; issues: ConfigIssue[] };

interface LintConfig {
  checks?: CheckOverrides;
  global?: GlobalLintConfig;
  exclude?: string[];
}

/** Compiles the published lint schema with the configuration schema it refers to; validation runs once per command, so nothing is cached. */
function validator(): ValidateFunction<LintConfig> {
  const ajv = new Ajv2020({ allErrors: true, allowUnionTypes: true, strict: true });
  ajv.addSchema(readSchema("config"));
  return ajv.compile<LintConfig>(readSchema("lint"));
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
  return {
    ok: true,
    checks: candidate.checks ?? {},
    ...(candidate.global === undefined ? {} : { global: candidate.global }),
    ...(candidate.exclude === undefined ? {} : { exclude: candidate.exclude }),
  };
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
  const { checks, global, exclude } = validation;
  return {
    checks,
    ...(global === undefined ? {} : { global }),
    ...(exclude === undefined ? {} : { exclude }),
  };
}

/** The `checks` overrides of `<root>/concordance-lint.yaml` alone. */
export function readLintOverrides(fs: FileSystem, root: string): CheckOverrides {
  return readLintConfig(fs, root).checks;
}
