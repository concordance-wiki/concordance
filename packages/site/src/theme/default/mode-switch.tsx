import type { JSX } from "preact";

import { island } from "../../islands/island.js";
import { switchGlyph } from "../../mode.js";

export const MODE_SWITCH_ISLAND = "mode-switch";

export interface ModeSwitchProps {
  /** The name of the toggle, "Dark mode", written for assistive technology alone; pressed while the dark scheme is displayed. */
  label: string;
}

/**
 * A square button drawing the glyph of the scheme it switches to, a moon over a light page, a
 * sun over a dark one, its label written for assistive technology only. It is served hidden and
 * does nothing until its script wires it: without JavaScript the theme's default and the system
 * preference apply, and no dead control is shown.
 */
function ModeSwitchButton({ label }: ModeSwitchProps): JSX.Element {
  return (
    <button type="button" class="mode-switch" aria-pressed="false" title={label} hidden>
      <span class="mode-switch-glyph" aria-hidden="true">
        {switchGlyph("light")}
      </span>
      <span class="visually-hidden">{label}</span>
    </button>
  );
}

const ModeSwitchIsland = island(MODE_SWITCH_ISLAND, ModeSwitchButton);

/** The switch of the bar, named by the build in the language of the site. */
export function ModeSwitch({ label }: ModeSwitchProps): JSX.Element {
  return <ModeSwitchIsland label={label} />;
}
