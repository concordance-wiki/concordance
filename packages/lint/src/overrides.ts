export {
  LINT_CONFIG_FILE,
  LintConfigError,
  parseLintConfig,
  readLintConfig,
  readLintOverrides,
  type GlobalLintConfig,
  type LintConfigValidation,
  type LintOverrides,
} from "@concordance-wiki/core";

/** Where the global scope keeps the published model between two runs, relative to the repository root. */
export const DEFAULT_CACHE_DIR = ".concordance-cache/lint";

/** How long a cached model is reused without any request, in hours. */
export const DEFAULT_MAX_AGE_HOURS = 24;
