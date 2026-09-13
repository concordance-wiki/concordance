import type { JSX } from "preact";

import { SLOT_NAMES, type SlotName } from "../slots.js";
import type { ThemeOverride } from "../theme/types.js";
import type { GalleryPage } from "./pages.js";

export interface GalleryIndexProps {
  pages: readonly GalleryPage[];
  overrides: readonly ThemeOverride[];
}

const CHROME_SLOTS: ReadonlySet<SlotName> = new Set(["Shell", "Header", "Footer"]);

function Provenance({ override }: { override: ThemeOverride | undefined }): JSX.Element {
  return override === undefined ? (
    <p class="gallery-provenance">Rendered by the default theme.</p>
  ) : (
    <p class="gallery-provenance">
      Overridden by plugin <code>{override.plugin}</code>, theme <code>{override.theme}</code>.
    </p>
  );
}

function Slot({
  name,
  pages,
  override,
}: {
  name: SlotName;
  pages: readonly GalleryPage[];
  override: ThemeOverride | undefined;
}): JSX.Element {
  const id = `slot-${name.toLowerCase()}`;
  return (
    <section class="gallery-slot" aria-labelledby={id}>
      <h2 id={id}>{name}</h2>
      <Provenance override={override} />
      <ul>
        {CHROME_SLOTS.has(name) && <li>default: shown on every page of the gallery</li>}
        {pages.map((page) => (
          <li key={page.file}>
            <a href={page.file}>{page.state}</a>: {page.description}
          </li>
        ))}
      </ul>
    </section>
  );
}

/** The entry page of the gallery: every slot, who renders it, and one link per state. */
export function GalleryIndex({ pages, overrides }: GalleryIndexProps): JSX.Element {
  return (
    <div class="gallery">
      <h1>Component gallery</h1>
      <p>
        Every slot of the site rendered through the current theme with fixture view models. The
        links inside the pages lead nowhere: the data is invented. The labels are those of the
        default theme.
      </p>
      <p>
        Dark scheme: the stylesheet follows the system preference, and the switch in the header
        forces a scheme and remembers it; without JavaScript, set <code>data-mode="dark"</code> on
        the root element of a page to preview the dark palette.
      </p>
      {SLOT_NAMES.map((name) => (
        <Slot
          key={name}
          name={name}
          pages={pages.filter((page) => page.slot === name)}
          override={overrides.find((override) => override.slot === name)}
        />
      ))}
    </div>
  );
}
