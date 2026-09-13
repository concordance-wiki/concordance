import type { Entity } from "@concordance-wiki/core";

import { byCodeUnit } from "../order.js";
import type { HomeEntry, HomeItem, HomeProps, Link } from "../slots.js";
import { citations, message, typeLabel, type SiteContext } from "./context.js";
import { entityHref, HOME_PAGE, INDEX_PAGE, relativeHref } from "./paths.js";

/** The most cited entities offered under the title. */
export const HOME_SHORTCUTS = 5;

function counted(
  context: SiteContext,
  key: (entity: Entity) => string | undefined,
  label: (value: string) => string,
): HomeItem[] {
  const counts = new Map<string, number>();
  for (const entity of context.model.entities) {
    const value = key(entity);
    if (value !== undefined) {
      counts.set(value, (counts.get(value) ?? 0) + 1);
    }
  }
  return [...counts.entries()]
    .sort(([a], [b]) => byCodeUnit(a, b))
    .map(([value, count]) => ({
      label: label(value),
      href: relativeHref(HOME_PAGE, INDEX_PAGE),
      count,
    }));
}

/** The most cited entities first, the identifier breaking ties; entities nobody cites are left out. */
export function shortcutsOf(context: SiteContext): Link[] {
  return [...context.model.entities]
    .map((entity) => ({ entity, count: citations(context, entity.id) }))
    .filter(({ count }) => count > 0)
    .sort((a, b) => b.count - a.count || byCodeUnit(a.entity.id, b.entity.id))
    .slice(0, HOME_SHORTCUTS)
    .map(({ entity }) => ({ label: entity.title, href: entityHref(HOME_PAGE, entity.id) }));
}

/**
 * The three entry points, as counts of the model: domains, types and applications, each item
 * leading to the alphabetical index until the entries have pages of their own.
 */
export function entriesOf(context: SiteContext): HomeEntry[] {
  const index = relativeHref(HOME_PAGE, INDEX_PAGE);
  const names = context.names ?? {};
  return [
    {
      kind: "tree",
      title: message(context, "nav.domains"),
      href: index,
      items: counted(
        context,
        (entity) => entity.domain,
        (domain) => names.domains?.[domain] ?? domain,
      ),
    },
    {
      kind: "index",
      title: message(context, "nav.types"),
      href: index,
      items: counted(
        context,
        (entity) => entity.type,
        (type) => typeLabel(context, type),
      ),
    },
    {
      kind: "recent",
      title: message(context, "nav.applications"),
      href: index,
      items: counted(
        context,
        (entity) => entity.application,
        (application) => names.applications?.[application] ?? application,
      ),
    },
  ];
}

/** The view model of the home page; the search field waits for the search index. */
export function homeOf(context: SiteContext, title: string): HomeProps {
  const { build } = context.model;
  return {
    title,
    shortcuts: shortcutsOf(context),
    stats: {
      sources: build.sources.length,
      files: build.sources.reduce((total, source) => total + (source.files ?? 0), 0),
      builtAt: build.at,
    },
    entries: entriesOf(context),
  };
}
