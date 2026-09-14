import type { JSX } from "preact";

import { island } from "../islands/island.js";
import { GALLERY_WIDTHS, type GalleryWidth } from "./page.js";

export const GALLERY_WIDTH_ISLAND = "gallery-width";

export interface WidthSwitchProps {
  /** The accessible name of the group of buttons. */
  label: string;
  widths: readonly GalleryWidth[];
}

/**
 * Three buttons, one per width of the boards, served hidden: without a script every frame keeps
 * the width its state declares, and no dead control is shown. Once wired, a button sets every
 * frame of the index to its width.
 */
function WidthButtons({ label, widths }: WidthSwitchProps): JSX.Element {
  return (
    <div class="gallery-widths" role="group" aria-label={label} hidden>
      {widths.map((width) => (
        <button
          key={width}
          type="button"
          class="gallery-width"
          data-width={width}
          aria-pressed="false"
        >
          {width} px
        </button>
      ))}
    </div>
  );
}

const WidthSwitchIsland = island(GALLERY_WIDTH_ISLAND, WidthButtons);

/** The width switch of the index, a classic island like those of the site. */
export function WidthSwitch(): JSX.Element {
  return <WidthSwitchIsland label="Width of the frames" widths={GALLERY_WIDTHS} />;
}
