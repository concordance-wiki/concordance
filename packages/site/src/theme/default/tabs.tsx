import type { JSX } from "preact";

import { island } from "../../islands/island.js";

export const TABS_ISLAND = "tabs";

/** How many tabs the stylesheet marks as current by their position without any script; a page rarely has more than three. */
export const TABS_MARKED = 4;

/** One tab as the island receives it: the id of its panel and its label. */
export interface TabEntry {
  /** The id of the panel, the target of the tab: `representation-transcript`. */
  id: string;
  label: string;
}

/** One tab of a page with what its panel holds. */
export interface Tab extends TabEntry {
  content: JSX.Element;
}

export interface TabListProps {
  /** Accessible name of the row of tabs. */
  label: string;
  tabs: TabEntry[];
}

/** The id of the tab of a panel. */
export function tabIdOf(panel: string): string {
  return `tab-${panel}`;
}

/**
 * The row of tabs, following the tablist pattern: each tab an anchor to its panel, controlling
 * it and labelling it, the first one served selected. Without any script the anchors work and
 * the stylesheet shows the targeted panel; the island keeps the selected state on the tab whose
 * panel is shown and moves it with the arrow keys.
 */
function TabList({ label, tabs }: TabListProps): JSX.Element {
  return (
    <div class="tabs-list" role="tablist" aria-label={label}>
      {tabs.map((tab, index) => (
        <a
          key={tab.id}
          class="tab"
          role="tab"
          id={tabIdOf(tab.id)}
          href={`#${tab.id}`}
          aria-controls={tab.id}
          aria-selected={index === 0 ? "true" : "false"}
        >
          {tab.label}
        </a>
      ))}
    </div>
  );
}

export const TabListIsland = island(TABS_ISLAND, TabList);

/**
 * Tabs over panels: the row of tabs with, at its end, what the page adds to the bar (a mention,
 * a button); then one panel per tab, labelled by its tab. The stylesheet shows one panel at a
 * time without any script, the targeted one, the one holding the targeted anchor, else the
 * first; the island takes over once it runs.
 */
export function Tabs({
  label,
  tabs,
  className,
  trailing,
}: {
  /** Accessible name of the row of tabs. */
  label: string;
  tabs: Tab[];
  /** The class of the page on the block, next to `tabs`, for its own rules. */
  className: string;
  /** What the page adds at the end of the bar: a mention, a button. */
  trailing?: JSX.Element;
}): JSX.Element {
  return (
    <div class={`tabs ${className}`}>
      <div class="tabs-bar">
        <TabListIsland
          label={label}
          tabs={tabs.map(({ id, label: name }) => ({ id, label: name }))}
        />
        {trailing}
      </div>
      <div class="tabs-panels">
        {tabs.map((tab) => (
          <section
            key={tab.id}
            class="tabs-panel"
            role="tabpanel"
            id={tab.id}
            aria-labelledby={tabIdOf(tab.id)}
          >
            {tab.content}
          </section>
        ))}
      </div>
    </div>
  );
}
