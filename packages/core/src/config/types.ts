/** A BCP 47 language tag; the engine ships packs for `en` and `fr`, plugins may add others. */
export type Locale = string;

export interface ProjectConfig {
  name: string;
  locale?: Locale;
  theme?: string;
  edit_url?: string;
}

export type PluginConfig = string | { name: string; options?: Record<string, unknown> };

export interface ApplicationConfig {
  id: string;
  title?: string;
  status?: "active" | "legacy" | "target";
}

export interface DomainConfig {
  id: string;
  title?: string;
  match?: string[];
  subdomains?: DomainConfig[];
}

export interface PseudonymizeConfig {
  enabled?: boolean;
  scope?: string[];
  dictionary?: string;
  keep_roles?: boolean;
}

export interface PrivacyConfig {
  exclude?: string[];
  publish_transcripts?: boolean;
  pseudonymize?: PseudonymizeConfig;
}

export interface TypingRuleMatch {
  path?: string;
  suffix?: string;
  ext?: string[];
  frontmatter?: string;
}

export interface TypingRule {
  match: TypingRuleMatch;
  set: Record<string, string | number | boolean>;
}

export interface SourceConfig {
  name: string;
  git?: string;
  ref?: string;
  path?: string;
  kind?: "git" | "path" | "tracker";
  locale?: Locale;
  type?: string;
  default_type?: string;
  application?: string;
  glossary?: boolean;
  convert?: boolean;
  previews?: boolean;
  defaults?: Record<string, string | number | boolean>;
  rules?: TypingRule[];
  provider?: string;
  project?: string;
}

export interface StalenessConfig {
  warn_after_days?: Record<string, number>;
}

export interface InferenceConfig {
  glossary_sources?: string[];
  stopwords?: string[];
  short_terms?: string[];
  type_prefixes?: Record<string, Record<string, string[]>>;
  cross_source_links?: boolean;
  ngrams?: { min?: number; max?: number; min_occurrences?: number; min_documents?: number };
  keyword_pages?: { min_occurrences?: number; min_files?: number };
  neighbours?: { k?: number };
  candidate_score?: number;
  duplicates?: DuplicatesConfig;
}

/** `inference.duplicates`: how twin resources of one document are reconciled. */
export interface DuplicatesConfig {
  mode?: "estimate" | "exact" | "auto";
  exact_above?: number;
  size_ratio_min?: number;
  shingle_size?: number;
  minhash_functions?: number;
  merge_above?: number;
  candidate_above?: number;
}

export interface ConversionConfig {
  timeout_s?: number;
  max_size_mb?: number;
  cache?: string;
  parallelism?: number;
}

export interface BuildConfig {
  output?: string;
  fail_on?: { errors?: boolean; unconverted_max?: number };
  mentions_inline?: number;
  extracted_text_max_chars?: number;
}

export interface SiteConfig {
  /** Nodes of the neighbourhood mini-map of a page: 6 by default, 12 at most. */
  neighbourhood?: { size?: number };
}

export type CheckOverrides = Record<
  string,
  { severity?: "error" | "warning" | "info"; enabled?: boolean }
>;

export interface Config {
  version: 1;
  project: ProjectConfig;
  profile?: string;
  plugins?: PluginConfig[];
  applications?: ApplicationConfig[];
  domains?: DomainConfig[];
  privacy?: PrivacyConfig;
  sources: SourceConfig[];
  staleness?: StalenessConfig;
  inference?: InferenceConfig;
  conversion?: ConversionConfig;
  build?: BuildConfig;
  site?: SiteConfig;
  checks?: CheckOverrides;
  lock?: string;
}

export type ConfigIssueSeverity = "error" | "warning";

export interface ConfigIssue {
  severity: ConfigIssueSeverity;
  /** Dotted path of the faulty key, `sources[1].git` style; empty for the whole document. */
  path: string;
  message: string;
  received?: unknown;
  expected?: string;
}

export type ConfigValidation =
  { ok: true; config: Config; issues: ConfigIssue[] } | { ok: false; issues: ConfigIssue[] };
