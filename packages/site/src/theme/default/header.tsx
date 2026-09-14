import type { JSX } from "preact";

import type { HeaderLogo, HeaderProps } from "../../slots.js";
import { defaultHeaderLabels, Drawer } from "./drawer.js";
import { labels } from "./labels.js";
import { ModeSwitch } from "./mode-switch.js";
import { Panels } from "./panel-handle.js";
import { SearchGlyph, SearchIsland } from "./search-island.js";
import { Trail } from "./trail.js";

/** The logo is decorative: the site title follows it as text, so an inline SVG is hidden from assistive technology. */
function Logo({ logo }: { logo: HeaderLogo }): JSX.Element {
  return "svg" in logo ? (
    <span class="site-logo" aria-hidden="true" dangerouslySetInnerHTML={{ __html: logo.svg }} />
  ) : (
    <img class="site-logo" src={logo.src} alt={logo.alt} />
  );
}

/**
 * The bar: the drawer button, the mark and the site name, the search field folded behind a
 * button where the bar is too narrow for it (the magnifier alone on the phone, the word with it
 * on the tablet), the trail folded behind its button once its script lists a page, the mode
 * switch; the links stand in the drawer, which the stylesheet keeps in view in the bar where it
 * has room. After the bar, the empty island whose script folds the side panels of the page.
 */
export function Header({
  siteTitle,
  homeHref,
  logo,
  navigation,
  spaces,
  space,
  search,
  trail,
  panels,
  drawerOpen = false,
  labels: given = {},
}: HeaderProps): JSX.Element {
  const text = { ...defaultHeaderLabels, ...given };
  return (
    <header class="site-header">
      <nav class="site-nav" aria-label={labels.siteNavigation}>
        <Drawer
          {...(spaces === undefined ? {} : { spaces })}
          {...(space === undefined ? {} : { space })}
          navigation={navigation}
          open={drawerOpen}
          labels={text}
        />
        <a class="site-title" href={homeHref}>
          {logo && <Logo logo={logo} />}
          <span class="site-name">{siteTitle}</span>
        </a>
        {search && (
          <details class="site-search-fold">
            <summary class="site-search-button">
              <SearchGlyph />
              <span class="site-search-label">{text.search}</span>
            </summary>
            <SearchIsland
              {...(search.root === undefined ? {} : { root: search.root })}
              search={search}
            />
          </details>
        )}
        <Trail {...(trail === undefined ? {} : { trail })} />
        <ModeSwitch label={text.darkMode} />
      </nav>
      <Panels {...(panels === undefined ? {} : { panels })} />
    </header>
  );
}
