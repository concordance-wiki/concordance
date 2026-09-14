import type { JSX } from "preact";

import { island } from "../../islands/island.js";
import { pinsMarkup } from "../../pins.js";
import type { PinsLabels, PinsProps } from "../../slots.js";
import { labels } from "./labels.js";

export const PINS_ISLAND = "pins";

/** The labels of the default theme, used when the header receives no pins. */
export const defaultPinsLabels: PinsLabels = {
  pin: labels.pin,
  pinned: labels.pinned,
  label: labels.pinsLabel,
  pages: labels.pinnedPages,
  countOne: labels.pinnedCountOne,
  countMany: labels.pinnedCountMany,
  unpin: labels.unpin,
  all: labels.allPinned,
  filter: labels.filterPins,
  removeAll: labels.removeAllPins,
  confirmRemoveAll: labels.confirmRemoveAllPins,
};

/** The pin drawn on the button of the page header, in the current colour. */
export const PIN_GLYPH =
  '<svg class="pin-glyph" width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" aria-hidden="true" focusable="false"><path d="M12 17v5M7 4h10l-1.5 7 3 3H5.5l3-3z"></path></svg>';

/**
 * The island is served empty on the pages of the site: what it shows lives in the reader's
 * browser, which only a script can read, so without JavaScript the bar has no row of pins.
 * Served with pins, for a preview, it holds the row the script would draw, and the script
 * leaves it alone.
 */
function PinsRegion({ base, current, labels: text, pinned }: PinsProps): JSX.Element | null {
  if (pinned === undefined) {
    return null;
  }
  // The markup is the one the script writes, built from the props alone and escaped by the same function.
  return (
    <div
      class="pins-preview"
      dangerouslySetInnerHTML={{
        __html: pinsMarkup({ base, current: current?.id, entries: pinned, labels: text }),
      }}
    />
  );
}

const PinsIsland = island<PinsProps>(PINS_ISLAND, PinsRegion);

export function Pins({ pins }: { pins?: PinsProps }): JSX.Element {
  return <PinsIsland {...(pins ?? { base: "", labels: defaultPinsLabels })} />;
}

/**
 * The button of the page header that pins the page and unpins it, drawn as a chip after the
 * title with the pin glyph and one word, "Pin" or "Pinned", pressed while the page is pinned.
 * It is served hidden with the English of the default theme and does nothing until the pins
 * island wires it, which words it in the language of the site: without JavaScript there is no
 * button, and the page stays whole. `pinned` draws it pressed as a decoration, to preview a
 * pinned page without serving a control nothing would wire.
 */
export function PinButton({ pinned = false }: { pinned?: boolean }): JSX.Element {
  const glyph = <span class="pin-button-glyph" dangerouslySetInnerHTML={{ __html: PIN_GLYPH }} />;
  return pinned ? (
    <span class="pin-button pin-button-pinned" aria-hidden="true">
      {glyph}
      <span class="pin-button-label">{labels.pinned}</span>
    </span>
  ) : (
    <button type="button" class="pin-button" aria-pressed="false" hidden>
      {glyph}
      <span class="pin-button-label">{labels.pin}</span>
    </button>
  );
}
