import { pagePath, type Entity } from "@concordance-wiki/core";
import { h, type JSX } from "preact";

import { byCodeUnit } from "../order.js";
import { message, type SiteContext } from "./context.js";
import { entityHref } from "./paths.js";

/** A former keyword address kept for the note that took the expression over. */
export interface Redirect {
  /** The keyword page identifier, `keywords/<slug>`. */
  from: string;
  to: Entity;
}

/**
 * The redirects of the site, by keyword identifier: every `keywords` entry of the fragments
 * whose identifier no page of the model holds; when two notes claim one address, the lower
 * identifier keeps it.
 */
export function redirectsOf(context: SiteContext): Redirect[] {
  const claims = new Map<string, Entity>();
  for (const entity of [...context.model.entities].sort((a, b) => byCodeUnit(a.id, b.id))) {
    for (const from of context.fragments.get(entity.id)?.keywords ?? []) {
      if (context.entities.has(from) || claims.has(from)) continue;
      claims.set(from, entity);
    }
  }
  return [...claims].sort(([a], [b]) => byCodeUnit(a, b)).map(([from, to]) => ({ from, to }));
}

/** The body of a redirect page: the title of the note, and the link the `<meta>` refresh follows. */
export function redirectBody(context: SiteContext, redirect: Redirect): JSX.Element {
  const href = redirectHref(redirect);
  return h(
    "div",
    { class: "redirect" },
    h("h1", null, redirect.to.title),
    h(
      "p",
      null,
      `${message(context, "keyword.noteWritten")} `,
      h("a", { href }, redirect.to.title),
    ),
  );
}

/** Where a redirect forwards, relative to its own page. */
export function redirectHref(redirect: Redirect): string {
  return entityHref(pagePath(redirect.from), redirect.to.id);
}
