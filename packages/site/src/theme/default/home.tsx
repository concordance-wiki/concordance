import type { JSX } from "preact";

import type { HomeEntry, HomeItem, HomeProps, HomeSource, HomeTreeNode } from "../../slots.js";
import { labels } from "./labels.js";

function Item({ item }: { item: HomeItem }): JSX.Element {
  return (
    <li class={item.stale === true ? "home-item stale" : "home-item"}>
      <a href={item.href}>{item.label}</a>
      {item.count !== undefined && <span class="count">{item.count}</span>}
      {item.date !== undefined && <time dateTime={item.date}>{item.dateLabel ?? item.date}</time>}
      {item.stale === true && <span class="stale-mark">{labels.dormant}</span>}
    </li>
  );
}

/** A source or a folder folds; only the sources start open. A note is a link. */
function TreeNode({ node, open }: { node: HomeTreeNode; open: boolean }): JSX.Element {
  if (node.children === undefined) {
    return (
      <li class="tree-note">
        <a href={node.href}>{node.label}</a>
      </li>
    );
  }
  return (
    <li class="tree-folder">
      <details open={open}>
        <summary>
          {node.label}
          {node.count !== undefined && <span class="count">{node.count}</span>}
        </summary>
        <ul>
          {node.children.map((child) => (
            <TreeNode key={child.label} node={child} open={false} />
          ))}
        </ul>
      </details>
    </li>
  );
}

function Source({ source }: { source: HomeSource }): JSX.Element {
  return (
    <li class={source.stale ? "home-source stale" : "home-source"}>
      <span class="home-source-name">{source.name}</span>
      {source.date !== undefined && (
        <time dateTime={source.date}>{source.dateLabel ?? source.date}</time>
      )}
      {source.stale && <span class="stale-mark">{labels.dormant}</span>}
    </li>
  );
}

function Entry({ entry }: { entry: HomeEntry }): JSX.Element {
  const id = `home-${entry.kind}`;
  return (
    <section class={`home-entry home-entry-${entry.kind}`} aria-labelledby={id}>
      <h2 id={id}>
        {entry.href === undefined ? entry.title : <a href={entry.href}>{entry.title}</a>}
      </h2>
      {entry.tree !== undefined && (
        <ul class="home-tree">
          {entry.tree.map((node) => (
            <TreeNode key={node.label} node={node} open={true} />
          ))}
        </ul>
      )}
      {entry.items.length > 0 && (
        <ul class="home-items">
          {entry.items.map((item) => (
            <Item key={item.href} item={item} />
          ))}
        </ul>
      )}
      {entry.sources !== undefined && (
        <ul class="home-sources" aria-label={labels.sourceFreshness}>
          {entry.sources.map((source) => (
            <Source key={source.name} source={source} />
          ))}
        </ul>
      )}
    </section>
  );
}

export function Home({ title, search, shortcuts, stats, entries, todo }: HomeProps): JSX.Element {
  return (
    <div class="home">
      <h1>{title}</h1>
      <p class="home-stats">
        {stats.sources} {labels.sources}, {stats.files} {labels.files}, {labels.builtOn}{" "}
        <time dateTime={stats.builtAt}>{stats.builtAtLabel ?? stats.builtAt}</time>
      </p>
      <div class="home-search-slot" data-slot="search">
        {search && (
          <form
            class="home-search"
            role="search"
            aria-label={labels.search}
            action={search.action}
            method="get"
          >
            <label for="home-search">{labels.search}</label>
            <input id="home-search" type="search" name="q" placeholder={search.placeholder} />
            <button type="submit">{labels.searchSubmit}</button>
          </form>
        )}
      </div>
      {shortcuts.length > 0 && (
        <ul class="home-shortcuts" aria-label={labels.shortcuts}>
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
      {todo && (
        <p class="home-todo">
          <a href={todo.href}>
            {todo.label}
            {todo.count !== undefined && <span class="count">{todo.count}</span>}
          </a>
        </p>
      )}
    </div>
  );
}
