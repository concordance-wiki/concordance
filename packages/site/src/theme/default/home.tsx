import type { JSX } from "preact";

import type { HomeEntry, HomeItem, HomeProps } from "../../slots.js";
import { labels } from "./labels.js";

function Item({ item }: { item: HomeItem }): JSX.Element {
  return (
    <li class={item.stale === true ? "home-item stale" : "home-item"}>
      <a href={item.href}>{item.label}</a>
      {item.count !== undefined && <span class="count">{item.count}</span>}
      {item.date !== undefined && <time dateTime={item.date}>{item.date}</time>}
      {item.stale === true && <span class="stale-mark">{labels.dormant}</span>}
    </li>
  );
}

function Entry({ entry }: { entry: HomeEntry }): JSX.Element {
  const id = `home-${entry.kind}`;
  return (
    <section class={`home-entry home-entry-${entry.kind}`} aria-labelledby={id}>
      <h2 id={id}>
        <a href={entry.href}>{entry.title}</a>
      </h2>
      <ul>
        {entry.items.map((item) => (
          <Item key={item.href} item={item} />
        ))}
      </ul>
    </section>
  );
}

export function Home({ title, search, shortcuts, stats, entries }: HomeProps): JSX.Element {
  return (
    <div class="home">
      <h1>{title}</h1>
      <p class="home-stats">
        {stats.sources} {labels.sources}, {stats.files} {labels.files}, {labels.builtOn}{" "}
        <time dateTime={stats.builtAt}>{stats.builtAt}</time>
      </p>
      {search && (
        <form class="home-search" role="search" action={search.action} method="get">
          <label for="home-search">{labels.search}</label>
          <input id="home-search" type="search" name="q" placeholder={search.placeholder} />
          <button type="submit">{labels.searchSubmit}</button>
        </form>
      )}
      {shortcuts.length > 0 && (
        <ul class="home-shortcuts">
          {shortcuts.map((link) => (
            <li key={link.href}>
              <a class="chip" href={link.href}>
                {link.label}
              </a>
            </li>
          ))}
        </ul>
      )}
      <nav class="home-entries" aria-label={labels.entryPoints}>
        {entries.map((entry) => (
          <Entry key={entry.kind} entry={entry} />
        ))}
      </nav>
    </div>
  );
}
