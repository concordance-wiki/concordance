import type { Finding, Severity } from "../model/finding.js";

/** Bumped by a core release that changes the shape of any contribution. */
export const PLUGIN_API_VERSION = "1";

export interface SystemDependency {
  name: string;
  /** Command run with `--version` to detect the dependency. */
  check: string;
  optional?: boolean;
}

/** A file handed to a reader: its path, used to pick the format and to name it in errors, and its raw bytes. */
export interface ReaderInput {
  path: string;
  payload: { bytes: Uint8Array };
}

/**
 * What a reader knows about a resource: its native properties (title, author, dates, counts) as a
 * flat record, and its text, empty when the format has no extractable text yet. Personal data in
 * the metadata is returned raw; pseudonymisation applies downstream, on the model.
 */
export interface ReaderOutput {
  metadata: Record<string, unknown>;
  text: string;
}

export interface Reader {
  extensions: string[];
  read: (input: ReaderInput) => ReaderOutput;
}

export type Representation = "pdf" | "thumbnails" | "text";

export interface ConversionLimits {
  timeoutMs: number;
  /** Larger sources are not converted. */
  maxSizeBytes: number;
}

/** What the pipeline hands to a converter: the source, its fingerprint, the cache and the limits. */
export interface ConverterPayload {
  bytes: Uint8Array;
  /** Hex SHA-256 of the bytes, the key of the conversion cache. */
  sha256: string;
  /** Folder of the pipeline cache; a converter keeps its temporary and cached files under it, never next to the source. */
  cacheDirectory: string;
  options: ConversionLimits;
}

export interface ConverterInput {
  path: string;
  payload: ConverterPayload;
}

/** A produced representation, as a file under the cache that the pipeline reads later. */
export interface RepresentationFile {
  path: string;
}

/** One entry per produced representation; a failed conversion has no entry and a finding instead. */
export interface ConverterOutput {
  representations: Partial<Record<Representation, RepresentationFile>>;
  findings: Finding[];
}

export interface Converter {
  extensions: string[];
  produces: Representation[];
  convert: (input: ConverterInput) => Promise<ConverterOutput>;
}

/** A source declaration of the configuration; the payload is the declaration itself once sources are typed. */
export interface SourceInput {
  name: string;
  payload: unknown;
}

/** Entities produced by a source; their shape follows the model, not fixed yet. */
export interface SourceOutput {
  entities: unknown[];
}

export interface SourceProvider {
  kind: string;
  load: (input: SourceInput) => Promise<SourceOutput>;
}

/** The model and the texts to infer from; the payload carries them once inference defines them. */
export interface InferenceInput {
  payload: unknown;
}

/** Links produced by a method; their shape follows the model, not fixed yet. */
export interface InferenceOutput {
  links: unknown[];
}

export interface InferenceMethod {
  method: string;
  infer: (input: InferenceInput) => InferenceOutput;
}

/** The model to check; the payload carries it once the model is typed. */
export interface CheckInput {
  payload: unknown;
}

export interface CheckContribution {
  id: string;
  severity: Severity;
  description: string;
  remediation: string;
  /** URL of the documentation page of the check. */
  documentation: string;
  run: (input: CheckInput) => Finding[];
}

/** The model to project; the payload carries it once the model is typed. */
export interface ProjectionInput {
  payload: unknown;
}

export interface ProjectionOutput {
  html: string;
  json: unknown;
}

export interface Projection {
  id: string;
  render: (input: ProjectionInput) => ProjectionOutput;
}

export interface UiComponent {
  slot: string;
  /** Path of the client bundle loaded on demand. */
  bundle: string;
}

/** A distributable theme: tokens, stylesheet, assets and component overrides, all paths relative to the plugin package. */
export interface ThemeContribution {
  name: string;
  /** Path of a `theme.yaml` (see the theme schema). */
  tokens: string;
  /** Path of a stylesheet loaded after the tool's own, in the `project` cascade layer. */
  stylesheet?: string;
  /** Path of a folder copied as-is into the site (fonts, icons). */
  assets?: string;
  /** Component overrides by slot name: path of a module whose default export renders that slot. */
  components?: Record<string, string>;
}

export interface Contributions {
  readers?: Reader[];
  converters?: Converter[];
  sources?: SourceProvider[];
  inferenceMethods?: InferenceMethod[];
  checks?: CheckContribution[];
  projections?: Projection[];
  uiComponents?: UiComponent[];
  themes?: ThemeContribution[];
}

export interface PluginManifest {
  name: string;
  version: string;
  apiVersion: string;
  systemDependencies?: SystemDependency[];
  contributes: Contributions;
}
