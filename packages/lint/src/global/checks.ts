import { posix } from "node:path";

import type { CheckId, StepFinding } from "@concordance-wiki/checks";
import {
  identifierFor,
  type CanonicalModel,
  type Config,
  type Entity,
  type FileSystem,
  type LintOverrides,
  type SourceConfig,
} from "@concordance-wiki/core";
import { readMarkdown, resolveLink, type ParsedMarkdown } from "@concordance-wiki/ingest";
import {
  comparisonForm,
  languagePack,
  resolveLocale,
  type LanguagePack,
} from "@concordance-wiki/nlp";
import {
  allowedRelations,
  type AttributeDefinition,
  type Profile,
} from "@concordance-wiki/profile";
import { resolveType } from "@concordance-wiki/typing";

import { lintedFiles } from "../files.js";
import { DEFAULT_SOURCE_NAME, leavesRoot } from "../local.js";

/**
 * The checks the global scope computes over the local notes and the entities of the published
 * model, sorted; the local scope reports `E-LINK-BROKEN` too, for links that stay in the repository.
 */
export const GLOBAL_CHECKS: readonly CheckId[] = [
  "E-LINK-BROKEN",
  "E-META-REL",
  "I-TERM-HOMONYM",
  "W-LINK-CROSS-SOURCE",
];

export interface GlobalChecksInput {
  /** Absolute path of the repository to check. */
  root: string;
  source?: SourceConfig;
  config?: Config;
  /** The content of `concordance-lint.yaml`; its `exclude` keeps files out of the checks. */
  overrides?: LintOverrides;
  /** Whether the files git ignores are left out; they are unless this is false. */
  gitignore?: boolean;
  fs: FileSystem;
  profile: Profile;
  /** The published model; its entities stand for every other source. */
  model: CanonicalModel;
}

interface LocalNote {
  id: string;
  type: string;
  title: string;
  aliases: string[];
  locale: string;
  path: string;
  document: ParsedMarkdown;
}

interface RemoteTarget {
  source: string;
  /** Path relative to the root of that source, as the model records it. */
  path: string;
}

interface Remote {
  byId: ReadonlyMap<string, Entity>;
  /** Keyed by `<source name>/<path>`. */
  byFile: ReadonlyMap<string, Entity>;
  sources: ReadonlySet<string>;
  at: string;
  crossSourceLinks: boolean | undefined;
}

const NO_FILES: ReadonlySet<string> = new Set();

function fileKey(source: string, path: string): string {
  return `${source}/${path}`;
}

function titleOf(document: ParsedMarkdown, path: string): string {
  const declared = document.frontmatter["title"];
  if (typeof declared === "string") return declared;
  return document.title ?? posix.basename(path, posix.extname(path));
}

function aliasesOf(document: ParsedMarkdown): string[] {
  const { aliases } = document.frontmatter;
  return Array.isArray(aliases)
    ? aliases.filter((alias): alias is string => typeof alias === "string")
    : [];
}

/** The notes of the repository as the build would type them; a file the local scope already reported is skipped. */
function localNotes(input: GlobalChecksInput): { notes: LocalNote[]; files: ReadonlySet<string> } {
  const { root, fs, profile } = input;
  const source = input.source ?? { name: DEFAULT_SOURCE_NAME };
  const locale = resolveLocale(source, input.config?.project ?? {});
  const suffixes = (source.rules ?? []).flatMap((rule) =>
    rule.match.suffix === undefined ? [] : [rule.match.suffix],
  );
  const files = lintedFiles(input);
  const notes: LocalNote[] = [];
  for (const path of files) {
    if (!path.endsWith(".md")) continue;
    const read = readMarkdown({ fs }, posix.join(root, path), path);
    if (!read.ok) continue;
    const { document } = read;
    const { frontmatter } = document;
    notes.push({
      id: identifierFor({
        source: source.name,
        path,
        typeSuffixes: suffixes,
        frontmatterId: frontmatter["id"],
      }).id,
      type: resolveType({ source, path, frontmatter, profile }).type,
      title: titleOf(document, path),
      aliases: aliasesOf(document),
      locale,
      path,
      document,
    });
  }
  return { notes, files: new Set(files) };
}

function indexModel(model: CanonicalModel): Remote {
  const byId = new Map<string, Entity>();
  const byFile = new Map<string, Entity>();
  const sources = new Set(model.build.sources.map((source) => source.name));
  for (const entity of model.entities) {
    byId.set(entity.id, entity);
    byFile.set(fileKey(entity.source.name, entity.source.path), entity);
    sources.add(entity.source.name);
  }
  return {
    byId,
    byFile,
    sources,
    at: model.build.at,
    crossSourceLinks: model.build.cross_source_links,
  };
}

/**
 * Where a link leaves the repository for: `<source>:<path>` names a source of the model, and a
 * relative path climbing one level above the root into `<source>/<path>` reaches a sibling source.
 * Anything else stays with the local scope or is a URL.
 */
function remoteTarget(
  target: string,
  note: LocalNote,
  files: ReadonlySet<string>,
  remote: Remote,
): RemoteTarget | undefined {
  const colon = target.indexOf(":");
  const prefix = colon === -1 ? undefined : target.slice(0, colon);
  if (prefix !== undefined && remote.sources.has(prefix)) {
    const resolved = resolveLink(target.slice(colon + 1), { path: "", sourceFiles: NO_FILES });
    return resolved.kind === "missing" ? { source: prefix, path: resolved.path } : undefined;
  }
  const resolved = resolveLink(target, { path: note.path, sourceFiles: files });
  if (resolved.kind !== "missing" || !leavesRoot(resolved.path)) return undefined;
  const [, source, ...rest] = resolved.path.split("/");
  return source !== undefined && rest.length > 0 && remote.sources.has(source)
    ? { source, path: rest.join("/") }
    : undefined;
}

function published(remote: Remote): string {
  return `the published model of ${remote.at}`;
}

/** Cross-source links to notes: a note the model does not know is broken; a known one warns when the build kept sources apart. */
function linkFindings(
  note: LocalNote,
  files: ReadonlySet<string>,
  remote: Remote,
  source: string,
): StepFinding[] {
  const findings: StepFinding[] = [];
  for (const link of note.document.links) {
    const target = remoteTarget(link.target, note, files, remote);
    if (!target?.path.endsWith(".md")) continue;
    const entity = remote.byFile.get(fileKey(target.source, target.path));
    const where = { source, path: note.path, line: link.line, entity: note.id };
    if (entity === undefined) {
      findings.push({
        check: "E-LINK-BROKEN",
        severity: "error",
        ...where,
        message: `link "${link.target}" in ${note.path} points to ${target.path} in source ${target.source}, which has no entity in ${published(remote)}`,
      });
    } else if (remote.crossSourceLinks === false) {
      findings.push({
        check: "W-LINK-CROSS-SOURCE",
        severity: "warning",
        ...where,
        message: `link "${link.target}" in ${note.path} reaches ${entity.id} in source ${target.source}, but ${published(remote)} was built with cross-source links disabled`,
      });
    }
  }
  return findings;
}

/** The frontmatter keys of a type that declare a relation, common attributes included. */
function referenceAttributes(profile: Profile, type: string): [string, AttributeDefinition][] {
  const attributes = { ...profile.common_attributes, ...profile.types[type]?.attributes };
  return Object.entries(attributes)
    .filter(
      ([, definition]) =>
        (definition.type === "ref" || definition.type === "ref[]") &&
        definition.relation !== undefined,
    )
    .sort(([a], [b]) => Number(a > b) - Number(a < b));
}

function referencedIds(value: unknown): string[] {
  if (typeof value === "string") return [value];
  return Array.isArray(value) ? value.filter((id): id is string => typeof id === "string") : [];
}

/** Every frontmatter reference resolved in the model, checked against the relation matrix of the profile. */
function relationFindings(
  note: LocalNote,
  remote: Remote,
  profile: Profile,
  source: string,
): StepFinding[] {
  const findings: StepFinding[] = [];
  for (const [key, definition] of referenceAttributes(profile, note.type)) {
    // The filter above kept the attributes that declare a relation.
    const relation = definition.relation as string;
    for (const id of referencedIds(note.document.frontmatter[key])) {
      const target = remote.byId.get(id);
      if (target === undefined || target.id === note.id) continue;
      const [from, to] =
        definition.inverse === true ? [target.type, note.type] : [note.type, target.type];
      if (allowedRelations(profile, from, to).includes(relation)) continue;
      findings.push({
        check: "E-META-REL",
        severity: "error",
        source,
        path: note.path,
        entity: note.id,
        message: `frontmatter key "${key}" of ${note.path} declares "${relation}" between ${note.type} and ${target.id} (${target.type}), a pair the profile does not allow, according to ${published(remote)}`,
      });
    }
  }
  return findings;
}

function packOf(locale: string): LanguagePack | undefined {
  try {
    return languagePack(locale);
  } catch {
    // A locale without a pack cannot be compared; the build reports it, the glossary check skips it.
    return undefined;
  }
}

type Forms = ReadonlyMap<string, readonly Entity[]>;

/** The comparison forms of every remote entity of a locale, keyed by form; entities keep the model's order. */
function remoteForms(model: CanonicalModel, locale: string, pack: LanguagePack): Forms {
  const forms = new Map<string, Entity[]>();
  for (const entity of model.entities) {
    if (entity.locale !== locale) continue;
    for (const written of new Set([entity.title, ...entity.aliases])) {
      const form = comparisonForm(written, pack);
      if (form === "") continue;
      const holders = forms.get(form) ?? [];
      if (!holders.includes(entity)) holders.push(entity);
      forms.set(form, holders);
    }
  }
  return forms;
}

/** A local title or alias that a remote entity of another type also carries. */
function homonymFindings(
  note: LocalNote,
  forms: Forms,
  pack: LanguagePack,
  remote: Remote,
  source: string,
): StepFinding[] {
  const findings: StepFinding[] = [];
  const seen = new Set<string>();
  for (const written of [note.title, ...note.aliases]) {
    const form = comparisonForm(written, pack);
    if (form === "" || seen.has(form)) continue;
    seen.add(form);
    for (const other of forms.get(form) ?? []) {
      if (other.id === note.id || other.type === note.type) continue;
      findings.push({
        check: "I-TERM-HOMONYM",
        severity: "info",
        source,
        path: note.path,
        entity: note.id,
        message: `"${written}" is the title or an alias of ${note.path} (${note.type}) and of ${other.id} (${other.type}) in ${published(remote)}`,
      });
    }
  }
  return findings;
}

/** The three global checks over the local notes and the remote entities; nothing is written, nothing is rebuilt. */
export function globalFindings(input: GlobalChecksInput): StepFinding[] {
  const source = input.source?.name ?? DEFAULT_SOURCE_NAME;
  const remote = indexModel(input.model);
  const { notes, files } = localNotes(input);
  const forms = new Map<string, { pack: LanguagePack; forms: Forms }>();
  const findings: StepFinding[] = [];
  for (const note of notes) {
    findings.push(
      ...linkFindings(note, files, remote, source),
      ...relationFindings(note, remote, input.profile, source),
    );
    let locale = forms.get(note.locale);
    if (locale === undefined) {
      const pack = packOf(note.locale);
      if (pack === undefined) continue;
      locale = { pack, forms: remoteForms(input.model, note.locale, pack) };
      forms.set(note.locale, locale);
    }
    findings.push(...homonymFindings(note, locale.forms, locale.pack, remote, source));
  }
  return findings;
}
