import {
  canonicalJson,
  pagePath,
  type Entity,
  type Link,
  type Provenance,
} from "@concordance-wiki/core";
import { formatMessage } from "@concordance-wiki/i18n";

import { byCodeUnit } from "../order.js";
import type { Mention, MentionsPanelProps } from "../slots.js";
import { fileKey, message, type SiteContext } from "./context.js";
import { entityHref, mentionsFragmentPath, relativeHref } from "./paths.js";

/** How many mentions the served HTML carries when the configuration says nothing (`build.mentions_inline`). */
export const DEFAULT_MENTIONS_INLINE = 20;

/** What the build writes as `fragments/<id>.mentions.json`: every mention of one entity, hrefs relative to its page. */
export interface MentionsFragment {
  id: string;
  mentions: Mention[];
}

const WRITTEN = new Set<Provenance["method"]>(["explicit_link", "frontmatter_ref"]);
const LOCATED = new Set<Provenance["method"]>([
  "explicit_link",
  "frontmatter_ref",
  "section_mention",
  "glossary_occurrence",
]);

/** The passage the scan kept, else the link text, else where the mention was read, else the title of the entity. */
function contextOf(context: SiteContext, entity: Entity, provenance: Provenance): string {
  const passage = provenance.occurrences?.[0];
  if (passage !== undefined) return passage.context;
  if (provenance.text !== undefined) return provenance.text;
  if (provenance.section !== undefined) {
    return formatMessage(context.catalogue, "mentions.inSection", { section: provenance.section });
  }
  return provenance.attribute ?? entity.title;
}

/**
 * The words of a passage that name the entity, as written there: what the scan matched when it
 * said so, else the longest of the title and aliases found without regard to case; nothing when
 * the context is not a passage.
 */
export function surfaceOf(entity: Entity, provenance: Provenance): string | undefined {
  const passage = provenance.occurrences?.[0];
  if (passage === undefined) return undefined;
  if (provenance.text !== undefined && passage.context.includes(provenance.text)) {
    return provenance.text;
  }
  const lowered = passage.context.toLowerCase();
  const names = [entity.title, ...entity.aliases]
    .filter((name) => name !== "")
    .sort((a, b) => b.length - a.length || byCodeUnit(a, b));
  for (const name of names) {
    const at = lowered.indexOf(name.toLowerCase());
    if (at >= 0) return passage.context.slice(at, at + name.length);
  }
  return undefined;
}

interface LocatedMention {
  mention: Mention;
  /** Source name, then path, then line: the corpus order. */
  source: string;
  path: string;
}

/**
 * The note a provenance was read from: its path is relative to the source of the end that holds
 * it, which relation typing may have turned around; the other end of the link is the candidate,
 * and a provenance read from the page's own note cites the other entity, not this one.
 */
function citingNote(
  context: SiteContext,
  entity: Entity,
  link: Link,
  path: string,
): Entity | undefined {
  const other = context.entities.get(link.from === entity.id ? link.to : link.from);
  if (other === undefined) return undefined;
  const note = context.byFile.get(fileKey(other.source.name, path));
  return note === undefined || note.id === entity.id ? undefined : note;
}

function mentionOf(
  context: SiteContext,
  page: string,
  entity: Entity,
  link: Link,
  provenance: Provenance,
): LocatedMention | undefined {
  if (!LOCATED.has(provenance.method) || provenance.path === undefined) return undefined;
  const note = citingNote(context, entity, link, provenance.path);
  if (note === undefined) return undefined;
  const href = entityHref(page, note.id);
  const line = provenance.line ?? note.source.line;
  const surface = surfaceOf(entity, provenance);
  return {
    mention: {
      kind: WRITTEN.has(provenance.method) ? "written" : "recognised",
      file: { label: provenance.path, href },
      context: contextOf(context, entity, provenance),
      line,
      href: `${href}#L${String(line)}`,
      ...(surface === undefined ? {} : { surface }),
    },
    source: note.source.name,
    path: provenance.path,
  };
}

/** Written links first, then recognised mentions, each group in corpus order; the model order breaks ties. */
export function mentionsOf(context: SiteContext, page: string, entity: Entity): Mention[] {
  const located: LocatedMention[] = [];
  for (const link of context.touching.get(entity.id) ?? []) {
    for (const provenance of link.provenance) {
      const mention = mentionOf(context, page, entity, link, provenance);
      if (mention !== undefined) located.push(mention);
    }
  }
  const rank = (item: LocatedMention): number => (item.mention.kind === "written" ? 0 : 1);
  return located
    .sort(
      (a, b) =>
        rank(a) - rank(b) ||
        byCodeUnit(a.source, b.source) ||
        byCodeUnit(a.path, b.path) ||
        a.mention.line - b.mention.line,
    )
    .map((item) => item.mention);
}

/** The view model of the panel of a page: its mentions, the inline threshold, the headings of the site locale and its fragment. */
export function mentionsPanelOf(
  context: SiteContext,
  page: string,
  entity: Entity,
  inline: number = DEFAULT_MENTIONS_INLINE,
): MentionsPanelProps {
  const mentions = mentionsOf(context, page, entity);
  return {
    mentions,
    initial: inline,
    headings: {
      written: message(context, "mentions.explicit"),
      recognised: message(context, "mentions.inferred"),
    },
    ...(mentions.length === 0
      ? {}
      : { fragmentHref: relativeHref(page, mentionsFragmentPath(entity.id)) }),
  };
}

/** The fragment of an entity with at least one mention; nothing for the others, so that no empty file is written. */
export function mentionsFragmentOf(
  context: SiteContext,
  entity: Entity,
): MentionsFragment | undefined {
  const mentions = mentionsOf(context, pagePath(entity.id), entity);
  return mentions.length === 0 ? undefined : { id: entity.id, mentions };
}

/** Canonical JSON, so that two builds of the same model write the same bytes. */
export function serializeMentionsFragment(fragment: MentionsFragment): string {
  return canonicalJson(fragment);
}
