import type { JSX } from "preact";

import type { Mention, RelatedLabels } from "../../slots.js";

/** One page that evokes the entity: every mention it holds, written and recognised alike, and what the entry shows of it. */
export interface RelatedPage {
  /** The href of the page, unique in the panel. */
  key: string;
  title: string;
  href: string;
  type?: string;
  typeLabel?: string;
  mentions: Mention[];
  /** Whether the page writes a link to the entity, the "cited" mark. */
  cited: boolean;
  /** The passage the entry quotes: the first written mention when there is one, else the first of all. */
  excerpt: Mention;
}

/**
 * Groups mentions by the page they come from, in the order the pages first appear, then orders
 * the pages from the surest to the weakest: the pages that write a link to the entity first,
 * then by number of passages, written and recognised counted alike; the first appearance
 * breaks ties, so that the corpus order holds among equals. The pages of the lead type, when
 * one is given, come before every other whatever their count or their link: the operations on
 * an API page.
 */
export function groupByPage(mentions: readonly Mention[], leadType?: string): RelatedPage[] {
  const pages = new Map<string, RelatedPage>();
  for (const mention of mentions) {
    const key = mention.file.href;
    const page = pages.get(key);
    if (page === undefined) {
      pages.set(key, {
        key,
        title: mention.title ?? mention.file.label,
        href: mention.file.href,
        ...(mention.type === undefined ? {} : { type: mention.type }),
        ...(mention.typeLabel === undefined ? {} : { typeLabel: mention.typeLabel }),
        mentions: [mention],
        cited: mention.kind === "written",
        excerpt: mention,
      });
    } else {
      page.mentions.push(mention);
      if (mention.kind === "written" && !page.cited) {
        page.cited = true;
        page.excerpt = mention;
      }
    }
  }
  const lead = (page: RelatedPage): number => (page.type === leadType ? 0 : 1);
  return [...pages.values()].sort(
    (a, b) =>
      lead(a) - lead(b) ||
      Number(b.cited) - Number(a.cited) ||
      b.mentions.length - a.mentions.length,
  );
}

/** Whether a page matches a filter typed by the reader: on its title, its type and its passages, without regard to case. */
export function matchesFilter(page: RelatedPage, filter: string): boolean {
  const needle = filter.trim().toLowerCase();
  return (
    needle === "" ||
    page.title.toLowerCase().includes(needle) ||
    (page.typeLabel ?? "").toLowerCase().includes(needle) ||
    page.mentions.some((mention) => mention.context.toLowerCase().includes(needle))
  );
}

/** The type slugs among pages with their labels and counts, most pages first, the slug breaking ties. */
export function typeCounts(
  pages: readonly RelatedPage[],
): { type: string; label: string; count: number }[] {
  const counts = new Map<string, { type: string; label: string; count: number }>();
  for (const page of pages) {
    if (page.type === undefined) continue;
    const known = counts.get(page.type);
    if (known === undefined) {
      counts.set(page.type, { type: page.type, label: page.typeLabel ?? page.type, count: 1 });
    } else {
      known.count += 1;
    }
  }
  return [...counts.values()].sort((a, b) => b.count - a.count || (a.type < b.type ? -1 : 1));
}

/** A message with `{name}` placeholders, each replaced by the value given. */
export function fill(pattern: string, values: Record<string, number | string>): string {
  return Object.entries(values).reduce(
    (text, [name, value]) => text.replaceAll(`{${name}}`, String(value)),
    pattern,
  );
}

/** The passage of a mention, the words naming the entity marked when the build found them. */
export function Context({ mention }: { mention: Mention }): JSX.Element {
  const { context, surface } = mention;
  const at = surface === undefined ? -1 : context.indexOf(surface);
  if (surface === undefined || at < 0) {
    return <q class="mention-context">{context}</q>;
  }
  return (
    <q class="mention-context">
      {context.slice(0, at)}
      <mark>{surface}</mark>
      {context.slice(at + surface.length)}
    </q>
  );
}

export interface RelatedListProps {
  pages: readonly RelatedPage[];
  labels: RelatedLabels;
}

/** How many entries stay in view where the panel is condensed; the others fold behind their count. */
export const RELATED_CONDENSED = 3;

function Entries({ pages, labels }: RelatedListProps): JSX.Element {
  return (
    <ol class="related-list">
      {pages.map((page) => (
        <li key={page.key} class={page.cited ? "related-page related-cited" : "related-page"}>
          <span class="related-head">
            <a class="related-title" href={page.href}>
              {page.title}
            </a>
            {page.typeLabel !== undefined && <span class="related-type">{page.typeLabel}</span>}
            <span class="related-count">
              {page.mentions.length}
              <span class="visually-hidden">
                {" "}
                {page.mentions.length === 1 ? labels.passage : labels.passages}
              </span>
            </span>
          </span>
          <a class="related-excerpt mention-passage" href={page.excerpt.href}>
            {page.cited && <span class="related-mark">{labels.cited} · </span>}
            {page.excerpt.location !== undefined && (
              <span class="related-location">{page.excerpt.location} · </span>
            )}
            <Context mention={page.excerpt} />
          </a>
        </li>
      ))}
    </ol>
  );
}

/**
 * One entry per page: its title linking to it, its type, its number of passages, then the
 * excerpt linking to the passage, prefixed "cited" when the page writes a link to the entity
 * and by the page, slide or timecode when the passage was read from a document. The entries
 * beyond the first three stand in a disclosure of their own, closed only where the stylesheet
 * condenses the panel, so that a narrow page shows three titles and the count of the others.
 */
export function RelatedList({ pages, labels }: RelatedListProps): JSX.Element {
  const rest = pages.slice(RELATED_CONDENSED);
  return (
    <>
      <Entries pages={pages.slice(0, RELATED_CONDENSED)} labels={labels} />
      {rest.length > 0 && (
        <details class="related-others">
          <summary>
            {fill(rest.length === 1 ? labels.other : labels.others, { count: rest.length })}
          </summary>
          <Entries pages={rest} labels={labels} />
        </details>
      )}
    </>
  );
}
