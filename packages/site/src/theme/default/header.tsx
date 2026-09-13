import type { JSX } from "preact";

import type { HeaderLogo, HeaderProps } from "../../slots.js";
import { labels } from "./labels.js";
import { ModeSwitch } from "./mode-switch.js";

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
}: HeaderProps): JSX.Element {
  return (
    <header class="site-header">
      <nav class="site-nav" aria-label={labels.siteNavigation}>
        <a class="site-title" href={homeHref}>
          {logo && <Logo logo={logo} />}
          {siteTitle}
        </a>
        {search && (
          <form
            class="site-search"
            role="search"
            aria-label={labels.siteSearch}
            action={search.action}
            method="get"
          >
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
        <ModeSwitch />
      </nav>
    </header>
  );
}
