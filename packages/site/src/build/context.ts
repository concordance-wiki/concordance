import type { CanonicalModel, Entity, Link, Locale, StalenessConfig } from "@concordance-wiki/core";
import {
  formatMessage,
  type Catalogue,
  type MessageArguments,
  type MessageId,
} from "@concordance-wiki/i18n";
import type { Label, Profile } from "@concordance-wiki/profile";

import type { EntityFragment } from "./fragments.js";

/** Titles the configuration gives to applications and domains, by identifier. */
export interface SiteNames {
  applications?: Record<string, string>;
  domains?: Record<string, string>;
}

export interface SiteContextInput {
  model: CanonicalModel;
  profile: Profile;
  catalogue: Catalogue;
  fragments: ReadonlyMap<string, EntityFragment>;
  names?: SiteNames;
  /** Pattern of the edit link, with `{source}`, `{path}` and `{commit}` placeholders. */
  editUrl?: string;
  /** The `ref` every source declares, by name; `main` is assumed for the others. */
  sourceRefs?: Record<string, string>;
  /** The `description` every source declares, by name: the content of its space on the spaces page. */
  sourceDescriptions?: Record<string, string>;
  /** The project locale, for the dates the pages spell out; the catalogue language when absent. */
  locale?: Locale;
  /** `staleness` of the configuration, which the home page reads to flag dormant sources. */
  staleness?: StalenessConfig;
  /** The collation of the project locale, the `compare` of its language pack; a collator of the locale when absent. */
  collate?: (a: string, b: string) => number;
  /** The names of the glossary sources, in declaration order; the first with a known forge receives new notes. */
  glossarySources?: string[];
}

/** Everything the page builders share: the model indexed, the profile, the labels. */
export interface SiteContext extends SiteContextInput {
  entities: ReadonlyMap<string, Entity>;
  /** Entities by `<source>/<path>`, the note and its other representations alike. */
  byFile: ReadonlyMap<string, Entity>;
  /** The links pointing at every entity, in model order. */
  incoming: ReadonlyMap<string, Link[]>;
  /** The links touching every entity at either end, in model order; a link never loops on its node. */
  touching: ReadonlyMap<string, Link[]>;
  /** The language whose type and relation labels are shown. */
  language: string;
  /** What the alphabetical index sorts titles with. */
  collate: (a: string, b: string) => number;
}

/** The collation the shipped language packs declare: accent-insensitive, digits compared by value. */
export function defaultCollation(locale: Locale): (a: string, b: string) => number {
  const collator = new Intl.Collator(locale, { sensitivity: "base", numeric: true });
  return (a, b) => collator.compare(a, b);
}

export function fileKey(source: string, path: string): string {
  return `${source}/${path}`;
}

export function siteContext(input: SiteContextInput): SiteContext {
  const entities = new Map<string, Entity>();
  const byFile = new Map<string, Entity>();
  const incoming = new Map<string, Link[]>();
  const touching = new Map<string, Link[]>();
  const add = (index: Map<string, Link[]>, id: string, link: Link): void => {
    const links = index.get(id);
    if (links === undefined) {
      index.set(id, [link]);
    } else {
      links.push(link);
    }
  };
  for (const entity of input.model.entities) {
    entities.set(entity.id, entity);
    if (entity.keyword !== true) {
      byFile.set(fileKey(entity.source.name, entity.source.path), entity);
      for (const representation of entity.representations ?? []) {
        byFile.set(fileKey(entity.source.name, representation.path), entity);
      }
    }
  }
  for (const link of input.model.links) {
    add(incoming, link.to, link);
    add(touching, link.from, link);
    add(touching, link.to, link);
  }
  const language = input.catalogue.language;
  return {
    ...input,
    entities,
    byFile,
    incoming,
    touching,
    language,
    collate: input.collate ?? defaultCollation(input.locale ?? language),
  };
}

/** A message of the catalogue that takes no argument. */
export function message(
  context: SiteContext,
  id: Exclude<MessageId, keyof MessageArguments>,
): string {
  return formatMessage(context.catalogue, id);
}

/** A label of the profile in the given language, English when it has no translation. */
export function labelIn(label: Label, language: string): string {
  const localized: Record<string, string | undefined> = { ...label };
  return localized[language] ?? label.en;
}

/** The label of a type in the site language; the slug when the profile does not declare the type. */
export function typeLabel(context: SiteContext, type: string): string {
  const definition = context.profile.types[type];
  return definition === undefined ? type : labelIn(definition.label, context.language);
}

export interface RelationLabelOptions {
  /**
   * Read the relation from its target, the way the page of an object names the screen that
   * accesses it: the `inverse_label` of the relation, or its plain label when it has none.
   */
  inverse?: boolean;
}

/** The label of a relation in the site language; the slug when the profile does not declare it. */
export function relationLabel(
  context: SiteContext,
  relation: string,
  options: RelationLabelOptions = {},
): string {
  const definition = context.profile.relations[relation];
  if (definition === undefined) return relation;
  const label =
    options.inverse === true && definition.inverse_label !== undefined
      ? definition.inverse_label
      : definition.label;
  return labelIn(label, context.language);
}

/** The glyph name the profile gives a type, as declared (`screen`, `api`…); none for a type without one. */
export function glyphNameOf(context: SiteContext, type: string): string | undefined {
  return context.profile.types[type]?.glyph;
}

/** The one-letter mark of a type, from the first character of its glyph name; none for a type without a glyph. */
export function glyphOf(context: SiteContext, type: string): string | undefined {
  const glyph = glyphNameOf(context, type);
  return glyph === undefined ? undefined : glyph.slice(0, 1).toUpperCase();
}

/** How many links point at an entity: what the index and the shortcuts call its citations. */
export function citations(context: SiteContext, id: string): number {
  return context.incoming.get(id)?.length ?? 0;
}

/** The ref the edit link of a source points at: the one it declares, else `main`. */
export const DEFAULT_SOURCE_REF = "main";

type Forge = "github" | "gitlab";

/** The forge an HTTPS repository URL names, with the repository address it edits; none for any other URL. */
function forgeOf(url: string): { forge: Forge; repository: string } | undefined {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return undefined;
  }
  if (parsed.protocol !== "https:") {
    return undefined;
  }
  const repository = `${parsed.origin}${parsed.pathname.replace(/\.git$/, "").replace(/\/$/, "")}`;
  if (parsed.hostname === "github.com") {
    return { forge: "github", repository };
  }
  if (parsed.hostname === "gitlab.com" || parsed.hostname.startsWith("gitlab.")) {
    return { forge: "gitlab", repository };
  }
  return undefined;
}

/**
 * The edit page of a file on the forge its HTTPS URL names: `<url>/edit/<ref>/<path>` on GitHub,
 * `<url>/-/edit/<ref>/<path>` on GitLab; none for any other URL or a local source.
 */
export function forgeEditHref(url: string, ref: string, path: string): string | undefined {
  const forge = forgeOf(url);
  if (forge === undefined) {
    return undefined;
  }
  return forge.forge === "github"
    ? `${forge.repository}/edit/${ref}/${path}`
    : `${forge.repository}/-/edit/${ref}/${path}`;
}

/**
 * The page that creates a file at the root of the repository on its forge, the name filled in:
 * `<url>/new/<ref>?filename=<file>` on GitHub, `<url>/-/new/<ref>?file_name=<file>` on GitLab;
 * none for any other URL.
 */
export function forgeNewFileHref(url: string, ref: string, file: string): string | undefined {
  const forge = forgeOf(url);
  if (forge === undefined) {
    return undefined;
  }
  const name = encodeURIComponent(file);
  return forge.forge === "github"
    ? `${forge.repository}/new/${ref}?filename=${name}`
    : `${forge.repository}/-/new/${ref}?file_name=${name}`;
}

/**
 * Where a note for a keyword is written: the new-file page of the first glossary source whose
 * URL names a forge, for `<slug>.md`; none without a glossary source on a known forge.
 */
export function createNoteHref(context: SiteContext, slug: string): string | undefined {
  for (const name of context.glossarySources ?? []) {
    const url = context.model.build.sources.find((candidate) => candidate.name === name)?.url;
    if (url === undefined) continue;
    const href = forgeNewFileHref(
      url,
      context.sourceRefs?.[name] ?? DEFAULT_SOURCE_REF,
      `${slug}.md`,
    );
    if (href !== undefined) return href;
  }
  return undefined;
}

function patternEditHref(pattern: string, source: Entity["source"]): string | undefined {
  if (pattern.includes("{commit}") && source.commit === undefined) {
    return undefined;
  }
  return pattern
    .replaceAll("{source}", source.name)
    .replaceAll("{path}", source.path)
    .replaceAll("{commit}", source.commit ?? "");
}

/**
 * The edit link of a note: the configured pattern when there is one (none when it needs a commit
 * the source did not record), else the forge the source URL of the model names.
 */
export function editHref(context: SiteContext, entity: Entity): string | undefined {
  const { source } = entity;
  const pattern = context.editUrl;
  if (pattern !== undefined) {
    return patternEditHref(pattern, source);
  }
  const url = context.model.build.sources.find((candidate) => candidate.name === source.name)?.url;
  if (url === undefined) {
    return undefined;
  }
  return forgeEditHref(url, context.sourceRefs?.[source.name] ?? DEFAULT_SOURCE_REF, source.path);
}
