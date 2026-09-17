import type { ErrorObject, ValidateFunction } from "ajv/dist/2020.js";

import { compiledSchema, type SchemaName } from "./schema.js";
import type { Config, ConfigIssue, ConfigValidation, DomainConfig } from "./types.js";

/** The validator of a published schema, compiled once per process and shared. */
function validator<T>(name: SchemaName): ValidateFunction<T> {
  return compiledSchema<T>(name);
}

/** The segments of a JSON pointer, `~1` read back as `/` and `~0` as `~`: the keys of a model carry slashes. */
function segmentsOf(instancePath: string): string[] {
  return instancePath
    .split("/")
    .slice(1)
    .map((segment) => segment.replaceAll("~1", "/").replaceAll("~0", "~"));
}

const PLAIN_KEY = /^[\w$-]+$/u;

/** The path as a reader writes it: `build.output`, `sources[0].name`, `checks.W-STALE`, `neighbours["specs/foo"][0]`. */
function pathOf(error: ErrorObject): string {
  const segments = segmentsOf(error.instancePath).map((segment) => {
    if (/^\d+$/.test(segment)) return `[${segment}]`;
    return PLAIN_KEY.test(segment) ? `.${segment}` : `[${JSON.stringify(segment)}]`;
  });
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
    case "type": {
      // A union type in the schema reaches here as an array of type names.
      const { type } = error.params as { type: string | string[] };
      return {
        severity: "error",
        path,
        message: "wrong type",
        received,
        expected: Array.isArray(type) ? type.join(" or ") : type,
      };
    }
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
/** The value the pointer names, or nothing as soon as a level is not an object to look into. */
function valueAt(document: unknown, instancePath: string): unknown {
  let current: unknown = document;
  for (const segment of segmentsOf(instancePath)) {
    if (typeof current !== "object" || current === null) return undefined;
    current = Reflect.get(current, segment);
  }
  return current;
}

/** The issues of a document against one of the published schemas, each naming the path of the faulty key. */
export function schemaIssues(name: SchemaName, document: unknown): ConfigIssue[] {
  const validate = validator<unknown>(name);
  if (validate(document)) {
    return [];
  }
  // The validator fills `errors` whenever it returns false.
  const relevant = (validate.errors as ErrorObject[]).filter(
    (error) => !isInsideFailedBranch(error) && !isPropertyNamesSummary(error),
  );
  return relevant.map((error) => describeKeyError(error, document));
}

/** Errors raised inside a oneOf branch describe the branch, not the document. */
function isInsideFailedBranch(error: ErrorObject): boolean {
  return /\/oneOf\/\d+\//.test(error.schemaPath);
}

/** A `propertyNames` failure comes with the error raised on the key itself, which names it. */
function isPropertyNamesSummary(error: ErrorObject): boolean {
  return error.keyword === "propertyNames";
}

/** The validator reports a faulty key at its object, never at the root; the issue names the key instead. */
function describeKeyError(error: ErrorObject, document: unknown): ConfigIssue {
  const issue = describeSchemaError(error, document);
  if (error.propertyName === undefined) {
    return issue;
  }
  const path = `${issue.path}.${error.propertyName}`;
  return { ...issue, path, message: "key is not allowed", received: error.propertyName };
}

/**
 * The folders of the site that are not a source's: a source of that name would write its space
 * page and its entity pages over them in silence.
 */
export const RESERVED_SOURCE_NAMES: readonly string[] = [
  "about",
  "assets",
  "fragments",
  "index",
  "keywords",
  "search",
  "spaces",
  "todo",
];

function reservedSources(config: Config): ConfigIssue[] {
  return config.sources.flatMap((source, index) =>
    RESERVED_SOURCE_NAMES.includes(source.name)
      ? [
          {
            severity: "error" as const,
            path: `sources[${String(index)}].name`,
            message: "source name is a folder the site reserves",
            received: source.name,
            expected: `a name other than ${RESERVED_SOURCE_NAMES.join(", ")}`,
          },
        ]
      : [],
  );
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

/** One issue per malformed glob of a list, at `<prefix>[<index>]`: a malformed glob matches nothing and says nothing. */
function malformedPatterns(patterns: readonly string[], prefix: string): ConfigIssue[] {
  return patterns.flatMap((pattern, index) =>
    isWellFormedGlob(pattern)
      ? []
      : [
          {
            severity: "error" as const,
            path: `${prefix}[${String(index)}]`,
            message: "glob pattern is malformed",
            received: pattern,
            expected: "balanced braces and brackets",
          },
        ],
  );
}

function malformedGlobs(domains: DomainConfig[], prefix: string): ConfigIssue[] {
  const issues: ConfigIssue[] = [];
  domains.forEach((domain, index) => {
    const path = `${prefix}[${String(index)}]`;
    issues.push(...malformedPatterns(domain.match ?? [], `${path}.match`));
    issues.push(...malformedGlobs(domain.subdomains ?? [], `${path}.subdomains`));
  });
  return issues;
}

/** The globs of `privacy.exclude` and of every `rules[].match.path`, checked like those of the domains. */
function malformedExcludesAndRules(config: Config): ConfigIssue[] {
  const issues = malformedPatterns(config.privacy?.exclude ?? [], "privacy.exclude");
  config.sources.forEach((source, sourceIndex) => {
    (source.rules ?? []).forEach((rule, ruleIndex) => {
      const path = rule.match.path;
      if (path !== undefined && !isWellFormedGlob(path)) {
        issues.push({
          severity: "error",
          path: `sources[${String(sourceIndex)}].rules[${String(ruleIndex)}].match.path`,
          message: "glob pattern is malformed",
          received: path,
          expected: "balanced braces and brackets",
        });
      }
    });
  });
  return issues;
}

/** The keys the build accepts without reading, in whole or in part; the warning says exactly what is read. */
function ignoredFeatures(config: Config): ConfigIssue[] {
  const issues: ConfigIssue[] = [];
  if (config.lock !== undefined) {
    issues.push({
      severity: "warning",
      path: "lock",
      message:
        "rejected_terms, duplicates and domains of the lock file are applied; links are recorded, not read",
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
  const fromSchema = schemaIssues("config", document);
  if (fromSchema.length > 0) {
    return { ok: false, issues: fromSchema };
  }
  const config = document as Config;
  const errors = [
    ...duplicateSources(config),
    ...reservedSources(config),
    ...malformedGlobs(config.domains ?? [], "domains"),
    ...malformedExcludesAndRules(config),
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
