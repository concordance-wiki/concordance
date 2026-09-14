import type { Clock } from "../io/clock.js";
import type { FileSystem } from "../io/file-system.js";
import type { CandidateObject, ContractRecord } from "../model/contract.js";
import type { Entity } from "../model/entity.js";
import type { Finding, Severity } from "../model/finding.js";
import type { Link, ProvenanceMethod } from "../model/link.js";

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
  /**
   * The text split into the addressable units of the format, in reading order, when it has
   * some: one per speaker turn of a transcript, labelled by its timecode. Absent when `text`
   * has no positions of its own.
   */
  units?: ReaderUnit[];
}

/** One addressable unit of a resource's text: what a citation points at. */
export interface ReaderUnit {
  /** How a reader names the position: a timecode such as `00:12:05` for a transcript. */
  label: string;
  text: string;
  /** Who speaks the unit, as the transcript names them; absent for a unit without a speaker or a format without any. */
  speaker?: string;
  /** Fragment identifier of the unit in the reader's own HTML rendering, when it has one. */
  anchor?: string;
}

/** The substitutions a rewrite applies: one to every spoken or written text, one to the name of a speaker. */
export interface TextSubstitution {
  text: (text: string) => string;
  speaker: (name: string) => string;
}

export interface Reader {
  extensions: string[];
  read: (input: ReaderInput) => ReaderOutput;
  /**
   * The file again, every text and every speaker passed through the substitution, its timecodes
   * and structure kept: what the site offers for download in place of a transcript it must not
   * publish as written. A reader without it never sees its transcripts published under
   * pseudonymisation: the pipeline copies no file it could not rewrite.
   */
  rewrite?: (input: ReaderInput, substitution: TextSubstitution) => Uint8Array;
}

/**
 * What a converter may produce: the PDF of the document, a folder of PNG thumbnails, and its
 * text as a JSON file `{ "pages": string[] }`, one entry per page of the PDF in page order.
 */
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

/** The effects a contribution runs through, injected by the pipeline so that tests run against doubles. */
export interface PluginContext {
  fs: FileSystem;
  clock: Clock;
  /** Absent when the build runs without network access; a contribution then reports what it could not fetch. */
  fetch?: typeof fetch;
}

/** What the pipeline hands to a source: the entities read from the notes, where each declared source lives and the cache. */
export interface SourcePayload {
  entities: Entity[];
  /** Absolute folder of each declared source by name, against which the paths written in notes resolve. */
  roots: Record<string, string>;
  /** Folder of the pipeline cache; a source keeps what it fetched under it, never next to the notes. */
  cacheDirectory: string;
  /** Confidence of each provenance method, as the profile declares it. */
  confidence: Partial<Record<ProvenanceMethod, number>>;
  /**
   * When every ingested file last changed, by source name then by path relative to the root of
   * the source: the last commit date in a repository, the file system date elsewhere. A source
   * plugin dates what it reads next to the notes by it, never by the clock of the build.
   */
  dates?: Record<string, Record<string, string>>;
}

export interface SourceInput {
  payload: SourcePayload;
  context: PluginContext;
}

/** What a source adds to the model; a contract it could not read is a finding, never an exception. */
export interface SourceOutput {
  entities: Entity[];
  links: Link[];
  candidates: CandidateObject[];
  contracts: ContractRecord[];
  findings: Finding[];
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

/**
 * A type module a plugin ships: the folder of the module, relative to the plugin package, whose
 * name is the slug of the type (`./types/runbook` declares `runbook`). The folder holds what the
 * type-module schema describes: `type.yaml`, `messages/`, `template.md`, `schema.json`, `components/`.
 */
export interface TypeContribution {
  path: string;
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
  types?: TypeContribution[];
}

export interface PluginManifest {
  name: string;
  version: string;
  apiVersion: string;
  systemDependencies?: SystemDependency[];
  contributes: Contributions;
}
