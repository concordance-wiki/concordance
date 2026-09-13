import type { JSX } from "preact";

import type { HeaderLogo, HeaderProps } from "../../slots.js";
import { labels } from "./labels.js";
import { ModeSwitch } from "./mode-switch.js";
import { SearchIsland } from "./search-island.js";
import { Trail } from "./trail.js";

/** The logo is decorative: the site title follows it as text, so an inline SVG is hidden from assistive technology. */
function Logo({ logo }: { logo: HeaderLogo }): JSX.Element {
  return "svg" in logo ? (
    <span class="site-logo" aria-hidden="true" dangerouslySetInnerHTML={{ __html: logo.svg }} />
  ) : (
    <img class="site-logo" src={logo.src} alt={logo.alt} />
  );
}

export function Header({
  siteTitle,
  homeHref,
  logo,
  navigation,
  search,
  trail,
}: HeaderProps): JSX.Element {
  return (
    <header class="site-header">
      <nav class="site-nav" aria-label={labels.siteNavigation}>
        <a class="site-title" href={homeHref}>
          {logo && <Logo logo={logo} />}
          {siteTitle}
        </a>
        {search && (
          <SearchIsland
            {...(search.root === undefined ? {} : { root: search.root })}
            search={search}
          />
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
        <ModeSwitch />
      </nav>
      <Trail {...(trail === undefined ? {} : { trail })} />
    </header>
  );
}
