/** A BCP 47 language tag; the engine ships packs for `en` and `fr`, plugins may add others. */
export type Locale = string;

/** The compliance an accessibility statement declares: the organisation's word, never derived. */
export type AccessibilityStatus = "non-compliant" | "partially-compliant" | "compliant";

/** What only the organisation that publishes the site can declare; no key has a default. */
export interface LegalConfig {
  /** HTTPS address of the legal notice. */
  mentions_url?: string;
  /** HTTPS address of the accessibility statement. */
  accessibility_url?: string;
  /** The compliance the accessibility statement declares, worded after its link in the footer. */
  accessibility_status?: AccessibilityStatus;
  /** HTTPS address of the personal data page. */
  privacy_url?: string;
}

export interface ProjectConfig {
  name: string;
  locale?: Locale;
  theme?: string;
  edit_url?: string;
  /** Where every call to action of the site leads when no forge link can be built for it. */
  contribute_url?: string;
  /** The legal pages the organisation declares, linked from the footer of every page. */
  legal?: LegalConfig;
  /** Path of a markdown file, relative to the configuration, rendered after the generated content of the about page. */
  about?: string;
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
  /** `true` claims the files under a folder named after the identifier, a string the files under that folder. */
  folder?: boolean | string;
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

/** The title and the description of a folder of a source, as the site shows them. */
export interface FolderConfig {
  /** The title of the folder wherever the site names it; its name as written on the paths when absent. */
  title?: string;
  /** One sentence on what the folder holds, shown on its card on the page of the space. */
  description?: string;
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
  /** The title of the space wherever the site names it; the name when absent. */
  title?: string;
  /** One sentence saying what the source holds, the content of its space on the spaces page. */
  description?: string;
  /** The folders of the source titled and described, by path relative to the source root. */
  folders?: Record<string, FolderConfig>;
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
  keyword_pages?: { min_occurrences?: number; min_files?: number; min_confidence?: number };
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
  /** HTTPS address the site is published at, path included; the page served for a missing address links back through it. */
  url?: string;
  /** Days between two publications; past three times that many, every page tells its reader how old the site is. */
  publish_every_days?: number;
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

/** The palette of one mode, six colours as `#RRGGBB` and three optional ones the default theme derives when absent. */
export interface ThemePalette {
  bg: string;
  surface: string;
  border: string;
  ink: string;
  muted: string;
  accent: string;
  /** The lightest text, labels and counts; `muted` when absent. */
  label?: string;
  /** The background of fields and chips, between `bg` and `surface`; `bg` when absent. */
  soft?: string;
  /** The background of a marked passage, read in `ink`; `border` when absent. */
  highlight?: string;
}

export type ThemeMode = "light" | "dark" | "system";

export interface ThemeFooterConfig {
  text?: string;
  links?: { label: string; url: string }[];
  /** Whether the footer credits the tool with a discreet link; false by default. */
  credit?: boolean;
}

/** A `theme.yaml` document once validated by the theme schema; paths are relative to the file. */
export interface ThemeConfig {
  name: string;
  logo?: string;
  favicon?: string;
  font?: { display?: string; ui?: string; mono?: string };
  radius?: number;
  light: ThemePalette;
  dark: ThemePalette;
  default_mode?: ThemeMode;
  footer?: ThemeFooterConfig;
  stylesheet?: string;
  assets?: string;
  labels?: Record<string, Record<string, string>>;
}

export type ThemeValidation =
  { ok: true; theme: ThemeConfig; issues: ConfigIssue[] } | { ok: false; issues: ConfigIssue[] };

/** A link a human promoted, `links.accepted[]` of the lock file. */
export interface LockAcceptedLink {
  from: string;
  to: string;
  rel: string;
  by?: string;
  at?: string;
}

/** A link a human rejected, `links.rejected[]` of the lock file. */
export interface LockRejectedLink {
  from: string;
  to: string;
  rel: string;
  reason?: string;
}

/** `concordance.lock.yaml`, mirroring `schemas/lock.schema.json`: the human decisions the build applies over its inferences. */
export interface LockFile {
  version: 1;
  /** Recorded, not read: the build of this version produces no `lock_promoted` link. */
  links?: { accepted?: LockAcceptedLink[]; rejected?: LockRejectedLink[] };
  duplicates?: { merged?: [string, string][]; separated?: [string, string][] };
  rejected_terms?: string[];
}

export type LockValidation =
  { ok: true; lock: LockFile; issues: ConfigIssue[] } | { ok: false; issues: ConfigIssue[] };
