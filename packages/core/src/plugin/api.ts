import type { Finding, Severity } from "../model/finding.js";

/** Bumped by a core release that changes the shape of any contribution. */
export const PLUGIN_API_VERSION = "1";

export interface SystemDependency {
  name: string;
  /** Command run with `--version` to detect the dependency. */
  check: string;
  optional?: boolean;
}

/** A file handed to a reader; the payload carries the bytes or text once ingestion defines them. */
export interface ReaderInput {
  path: string;
  payload: unknown;
}

/** Metadata and text of a resource; the shape follows the model, not fixed yet. */
export interface ReaderOutput {
  metadata: Record<string, unknown>;
  text: string;
}

export interface Reader {
  extensions: string[];
  read: (input: ReaderInput) => ReaderOutput;
}

export type Representation = "pdf" | "thumbnails" | "text";

/** A resource to convert; the payload carries the source bytes and the cache once conversion defines them. */
export interface ConverterInput {
  path: string;
  payload: unknown;
}

/** One entry per produced representation; the payload is the produced bytes or text. */
export interface ConverterOutput {
  representations: Partial<Record<Representation, unknown>>;
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
