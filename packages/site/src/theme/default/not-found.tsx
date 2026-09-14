import type { JSX } from "preact";

import { island } from "../../islands/island.js";
import { NOT_FOUND_ISLAND } from "../../islands/not-found.js";
import type { NearbyPage, NotFoundProps } from "../../slots.js";

/** What the island of the page carries: the parts the address changes, the exits and the nearby pages; the cause stays outside it. */
export type NotFoundIslandProps = Omit<NotFoundProps, "label" | "title" | "cause">;

/** The list of the pages whose address is close to the missing one; hidden while the island has named none. */
function Nearby({
  label,
  nearby,
}: {
  label: string;
  nearby: NearbyPage[] | undefined;
}): JSX.Element {
  return (
    <section
      class="not-found-nearby"
      aria-labelledby="not-found-nearby"
      hidden={nearby === undefined}
    >
      <h2 id="not-found-nearby" class="section-label">
        {label}
      </h2>
      <ul>
        {(nearby ?? []).map((page) => (
          <li key={page.href}>
            <a href={page.href}>
              <span class="not-found-nearby-title">{page.title}</span>
              <code class="not-found-nearby-path">{page.path}</code>
            </a>
          </li>
        ))}
      </ul>
    </section>
  );
}

/** The search of the site on the last segment of the missing address once the island read it; the search page as served. */
function SearchExit({
  searchHref,
  searchLabel,
  searchQueryLabel,
  query,
}: Pick<
  NotFoundIslandProps,
  "searchHref" | "searchLabel" | "searchQueryLabel" | "query"
>): JSX.Element {
  const named = query !== undefined && query !== "";
  return (
    <a
      class="button-primary"
      href={named ? `${searchHref}?q=${encodeURIComponent(query)}` : searchHref}
    >
      {named ? searchQueryLabel.replace("{query}", query) : searchLabel}
    </a>
  );
}

/** The nearby addresses once the island computed them, then the two exits, the search of the site and the list of the spaces. */
export function NotFoundExits(props: NotFoundIslandProps): JSX.Element {
  return (
    <>
      <Nearby label={props.nearbyLabel} nearby={props.nearby} />
      <p class="not-found-exits">
        <SearchExit {...props} />
        <a class="button-secondary" href={props.browse.href}>
          {props.browse.label}
        </a>
      </p>
    </>
  );
}

const NotFoundIsland = island(NOT_FOUND_ISLAND, NotFoundExits);

/**
 * The page served for a missing address, the only recourse of a static site: the cause in
 * plain words, what stays reachable, the nearby addresses once the island computed them from
 * the table of the pages, then two exits, the search of the site and the list of the spaces.
 * Everything but the nearby addresses and the query stands without JavaScript.
 */
export function NotFound({ label, title, cause, ...exits }: NotFoundProps): JSX.Element {
  return (
    <div class="not-found">
      <p class="section-label">{label}</p>
      <h1>{title}</h1>
      <p class="not-found-cause">{cause}</p>
      <NotFoundIsland {...exits} />
    </div>
  );
}
