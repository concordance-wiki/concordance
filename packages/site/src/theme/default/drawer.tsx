import type { JSX } from "preact";

import type { HeaderLabels, HeaderSpaces, NavigationItem, SpaceTree } from "../../slots.js";
import { labels } from "./labels.js";
import { SpaceTreeFold } from "./space-tree.js";

/** The labels of the default theme, used for every label the header does not receive. */
export const defaultHeaderLabels: HeaderLabels = {
  menu: labels.menu,
  search: labels.search,
  darkMode: labels.darkMode,
};

/** The spaces: the link to their place on the home page as a heading, then one entry per source with its initials and its note count. */
function Spaces({ spaces }: { spaces: HeaderSpaces }): JSX.Element {
  return (
    <div class="drawer-spaces">
      <a class="drawer-spaces-title" href={spaces.href}>
        {spaces.label}
      </a>
      <ul class="drawer-space-list">
        {spaces.items.map((space) => (
          <li key={space.label}>
            <a href={space.href}>
              <span class="space-initials" aria-hidden="true">
                {space.initials}
              </span>
              <span class="drawer-space-name">{space.label}</span>
              <span class="count">{space.count}</span>
            </a>
          </li>
        ))}
      </ul>
    </div>
  );
}

/**
 * The drawer of the narrow layouts: a disclosure whose summary is the menu button, so that it
 * opens without any script and over `file://`; inside, the spaces, the tree of the current
 * space unfolded to the page (the same tree as the left column, which the stylesheet shows in
 * one place at a time, so the copy here is no landmark), then the links of the bar. Where the
 * bar has room, the stylesheet hides the button, keeps the links in view in the bar and folds
 * the rest away.
 */
export function Drawer({
  spaces,
  space,
  navigation,
  open = false,
  labels: text,
}: {
  spaces?: HeaderSpaces;
  space?: SpaceTree;
  navigation: NavigationItem[];
  open?: boolean;
  labels: HeaderLabels;
}): JSX.Element {
  return (
    <details class="site-drawer" aria-label={text.menu} open={open}>
      <summary class="site-menu">
        <span class="visually-hidden">{text.menu}</span>
      </summary>
      <div class="drawer">
        {spaces !== undefined && <Spaces spaces={spaces} />}
        {space !== undefined && (
          <div class="drawer-space">
            <SpaceTreeFold space={space} open />
          </div>
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
      </div>
    </details>
  );
}
