import { Ajv2020, type ErrorObject, type ValidateFunction } from "ajv/dist/2020.js";

import { readSchema } from "./schema.js";
import type { Config, ConfigIssue, ConfigValidation, DomainConfig } from "./types.js";

/** Compiles the published schema; validation runs once per command, so nothing is cached. */
function validator(): ValidateFunction<Config> {
  const ajv = new Ajv2020({ allErrors: true, allowUnionTypes: true, strict: true });
  return ajv.compile<Config>(readSchema("config"));
}

function pathOf(error: ErrorObject): string {
  const segments = error.instancePath
    .split("/")
    .slice(1)
    .map((segment) => (/^\d+$/.test(segment) ? `[${segment}]` : `.${segment}`));
  return segments.join("").replace(/^\./, "");
}

export function describeSchemaError(error: ErrorObject, document: unknown): ConfigIssue {
  const path = pathOf(error);
  const received = valueAt(document, error.instancePath);
  switch (error.keyword) {
    case "required": {
      const missing = (error.params as { missingProperty: string }).missingProperty;
      return {
        severity: "error",
        path: path === "" ? missing : `${path}.${missing}`,
        message: "required key is missing",
      };
    }
    case "additionalProperties": {
      const extra = (error.params as { additionalProperty: string }).additionalProperty;
      return {
        severity: "error",
        path: path === "" ? extra : `${path}.${extra}`,
        message: "unknown key",
        expected: "one of the documented keys",
      };
    }
    case "enum": {
      const allowed = (error.params as { allowedValues: unknown[] }).allowedValues;
      return {
        severity: "error",
        path,
        message: "value is not allowed",
        received,
        expected: `one of ${allowed.map((value) => JSON.stringify(value)).join(", ")}`,
      };
    }
    case "const":
      return {
        severity: "error",
        path,
        message: "value is not allowed",
        received,
        expected: JSON.stringify((error.params as { allowedValue: unknown }).allowedValue),
      };
    case "type":
      return {
        severity: "error",
        path,
        message: "wrong type",
        received,
        expected: (error.params as { type: string }).type,
      };
    case "pattern":
      return {
        severity: "error",
        path,
        message: "value does not match the expected format",
        received,
        expected: `a value matching ${(error.params as { pattern: string }).pattern}`,
      };
    case "oneOf":
      return {
        severity: "error",
        path,
        message: /^sources\[\d+\]$/.test(path)
          ? "exactly one of git, path or kind: tracker is expected"
          : "value matches none of the accepted shapes",
        received,
      };
    default:
      return { severity: "error", path, message: error.message ?? error.keyword, received };
  }
}

/** Follows a JSON pointer produced by the validator; configuration keys never need unescaping. */
function valueAt(document: unknown, instancePath: string): unknown {
  let current: unknown = document;
  for (const segment of instancePath.split("/").slice(1)) {
    current = (current as Record<string, unknown>)[segment];
  }
  return current;
}

function issuesFromSchema(document: unknown): ConfigIssue[] {
  const validate = validator();
  if (validate(document)) {
    return [];
  }
  // The validator fills `errors` whenever it returns false.
  const relevant = (validate.errors as ErrorObject[]).filter(
    (error) => !isInsideFailedBranch(error),
  );
  return relevant.map((error) => describeSchemaError(error, document));
}

/** Errors raised inside a oneOf branch describe the branch, not the document. */
function isInsideFailedBranch(error: ErrorObject): boolean {
  return /\/oneOf\/\d+\//.test(error.schemaPath);
}

function duplicateSources(config: Config): ConfigIssue[] {
  const seen = new Map<string, number>();
  const issues: ConfigIssue[] = [];
  config.sources.forEach((source, index) => {
    const first = seen.get(source.name);
    if (first === undefined) {
      seen.set(source.name, index);
    } else {
      issues.push({
        severity: "error",
        path: `sources[${String(index)}].name`,
        message: `source name is already used by sources[${String(first)}]`,
        received: source.name,
        expected: "a unique name per source",
      });
    }
  });
  return issues;
}

/** A glob is malformed when its braces or brackets do not balance. */
export function isWellFormedGlob(pattern: string): boolean {
  let braces = 0;
  let brackets = 0;
  for (const character of pattern) {
    if (character === "{") braces += 1;
    if (character === "}") braces -= 1;
    if (character === "[") brackets += 1;
    if (character === "]") brackets -= 1;
    if (braces < 0 || brackets < 0) return false;
  }
  return braces === 0 && brackets === 0;
}

function malformedGlobs(domains: DomainConfig[], prefix: string): ConfigIssue[] {
  const issues: ConfigIssue[] = [];
  domains.forEach((domain, index) => {
    const path = `${prefix}[${String(index)}]`;
    (domain.match ?? []).forEach((pattern, patternIndex) => {
      if (!isWellFormedGlob(pattern)) {
        issues.push({
          severity: "error",
          path: `${path}.match[${String(patternIndex)}]`,
          message: "glob pattern is malformed",
          received: pattern,
          expected: "balanced braces and brackets",
        });
      }
    });
    issues.push(...malformedGlobs(domain.subdomains ?? [], `${path}.subdomains`));
  });
  return issues;
}

function ignoredFeatures(config: Config): ConfigIssue[] {
  const issues: ConfigIssue[] = [];
  if (config.lock !== undefined) {
    issues.push({
      severity: "warning",
      path: "lock",
      message: "accepted but ignored: only rejected_terms of the lock file is read in this version",
    });
  }
  config.sources.forEach((source, index) => {
    if (source.kind === "tracker") {
      issues.push({
        severity: "warning",
        path: `sources[${String(index)}]`,
        message: "accepted but ignored: tracker sources are not read in this version",
      });
    }
  });
  return issues;
}

/** Enabling pseudonymisation without a dictionary would number every speaker and replace no name. */
function missingDictionary(config: Config): ConfigIssue[] {
  const pseudonymize = config.privacy?.pseudonymize;
  if (pseudonymize?.enabled !== true || pseudonymize.dictionary !== undefined) {
    return [];
  }
  return [
    {
      severity: "error",
      path: "privacy.pseudonymize.dictionary",
      message: "required key is missing when pseudonymize.enabled is true",
      expected: "the path of the pseudonyms file",
    },
  ];
}

/** Publishing transcripts is a governance decision; the build only points out that no name is hidden. */
function unpseudonymisedPublication(config: Config): ConfigIssue[] {
  const privacy = config.privacy;
  if (privacy?.publish_transcripts !== true || privacy.pseudonymize?.enabled === true) {
    return [];
  }
  return [
    {
      severity: "warning",
      path: "privacy.publish_transcripts",
      message:
        "transcripts are published without pseudonymisation: every speaker and every name is published as written",
    },
  ];
}

export function validateConfig(document: unknown): ConfigValidation {
  const schemaIssues = issuesFromSchema(document);
  if (schemaIssues.length > 0) {
    return { ok: false, issues: schemaIssues };
  }
  const config = document as Config;
  const errors = [
    ...duplicateSources(config),
    ...malformedGlobs(config.domains ?? [], "domains"),
    ...missingDictionary(config),
  ];
  if (errors.length > 0) {
    return { ok: false, issues: errors };
  }
  return {
    ok: true,
    config,
    issues: [...ignoredFeatures(config), ...unpseudonymisedPublication(config)],
  };
}
