export {
  CANONICAL_KEY_ORDER,
  normalizeFrontmatter,
  type NormalizeFrontmatterOptions,
} from "./fix/frontmatter.js";
export { fixRepository, type FixRepositoryInput, type FixRepositoryResult } from "./fix/index.js";
export { rewriteRenamedLinks } from "./fix/links.js";
export { deduceType, type DeduceTypeInput } from "./fix/type.js";
export type { FixChange, FixKind, FixRefusal } from "./fix/types.js";
export { REPOSITORY_URL, TOOL_NAME, type FormatContext } from "./formats/context.js";
export {
  formatFindingsAs,
  isOutputFormat,
  OUTPUT_FORMATS,
  type OutputFormat,
} from "./formats/index.js";
export { formatJson, type JsonReport } from "./formats/json.js";
export { formatJunit, JUNIT_CLEAN_CASE, JUNIT_SUITE_NAME } from "./formats/junit.js";
export { formatSarif, SARIF_SCHEMA_URL, SOURCE_ROOT_ID, type SarifLog } from "./formats/sarif.js";
export {
  DEFAULT_SOURCE_NAME,
  lintRepository,
  LOCAL_CHECKS,
  type LintRepositoryInput,
} from "./local.js";
export {
  LINT_CONFIG_FILE,
  LintConfigError,
  parseLintConfig,
  readLintOverrides,
  type LintConfigValidation,
} from "./overrides.js";
export {
  countBySeverity,
  documentationOf,
  formatFinding,
  formatFindings,
  hasFindingAtOrAbove,
  locationOf,
} from "./report.js";
