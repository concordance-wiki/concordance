import type { JSX } from "preact";

import { island } from "../../islands/island.js";
import type { Section } from "../../slots.js";
import { PanelBlock } from "./panel-block.js";

export const TOC_ISLAND = "toc";

/** The value of `aria-current` on the entry of the section being read. */
export const TOC_CURRENT = "location";

/** An entry of the table of contents: the identifier of a section and its heading. */
export interface TocEntry {
  id: string;
  heading: string;
}

export interface TocProps {
  entries: TocEntry[];
}

/**
 * The list of the sections, the first entry served as the current one: at the top of the page
 * that is the section being read, and without any script it stays so. The island moves the mark
 * to the section under the top of the viewport as the reader scrolls.
 */
function TocList({ entries }: TocProps): JSX.Element {
  return (
    <ol class="toc-list">
      {entries.map((entry, index) => (
        <li key={entry.id}>
          <a href={`#${entry.id}`} {...(index === 0 ? { "aria-current": TOC_CURRENT } : {})}>
            {entry.heading}
          </a>
        </li>
      ))}
    </ol>
  );
}

const TocIsland = island(TOC_ISLAND, TocList);

function isHeaded(section: Section): section is Section & { heading: string } {
  return section.heading !== undefined;
}

/** The table of contents: one entry per section of the note with a heading, counted after the heading of the block where it is folded. */
export function TableOfContents({
  sections,
  heading,
}: {
  sections: Section[];
  heading: string;
}): JSX.Element {
  const entries = sections
    .filter(isHeaded)
    .map((section) => ({ id: section.id, heading: section.heading }));
  return (
    <PanelBlock id="entity-toc" className="entity-toc" heading={heading} count={entries.length}>
      <TocIsland entries={entries} />
    </PanelBlock>
  );
}
