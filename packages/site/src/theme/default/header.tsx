import type { JSX } from "preact";

import type { HeaderProps } from "../../slots.js";
import { labels } from "./labels.js";

export function Header({
  siteTitle,
  homeHref,
  logo,
  navigation,
  search,
}: HeaderProps): JSX.Element {
  return (
    <header class="site-header">
      <nav class="site-nav" aria-label={labels.siteNavigation}>
        <a class="site-title" href={homeHref}>
          {logo && <img class="site-logo" src={logo.src} alt={logo.alt} />}
          {siteTitle}
        </a>
        {search && (
          <form class="site-search" role="search" action={search.action} method="get">
            <label class="visually-hidden" for="site-search">
              {labels.search}
            </label>
            <input id="site-search" type="search" name="q" placeholder={search.placeholder} />
          </form>
        )}
        <ul class="site-links">
          {navigation.map((item) => (
            <li key={item.href}>
              <a href={item.href}>
                {item.label}
                {item.count !== undefined && <span class="count">{item.count}</span>}
              </a>
            </li>
          ))}
        </ul>
      </nav>
    </header>
  );
}
