import type { JSX } from "preact";

import { island } from "../../islands/island.js";
import { MODE_GLYPHS, modeSwitchName, type ModeChoice } from "../../mode.js";
import { labels } from "./labels.js";

export const MODE_SWITCH_ISLAND = "mode-switch";

/** What the client entry needs: the name of the control and the label of each choice, so that no visible string lives in the bundle. */
export interface ModeSwitchProps {
  /** The name of the control, "Colour scheme", written before the current choice for assistive technology. */
  name: string;
  labels: Record<ModeChoice, string>;
}

/**
 * A square button drawing the glyph of the current choice, its name and the choice written for
 * assistive technology only. It is served hidden and does nothing until its script wires it:
 * without JavaScript the theme's default and the system preference apply, and no dead control
 * is shown.
 */
function ModeSwitchButton({ name, labels: choices }: ModeSwitchProps): JSX.Element {
  const title = modeSwitchName(name, choices.system);
  return (
    <button
      type="button"
      class="mode-switch"
      aria-pressed="false"
      aria-label={title}
      title={title}
      hidden
    >
      <span class="mode-switch-glyph" aria-hidden="true">
        {MODE_GLYPHS.system}
      </span>
      <span class="visually-hidden">
        <span class="mode-switch-label">{name}</span>{" "}
        <span class="mode-switch-value">{choices.system}</span>
      </span>
    </button>
  );
}

const ModeSwitchIsland = island(MODE_SWITCH_ISLAND, ModeSwitchButton);

export function ModeSwitch(): JSX.Element {
  return (
    <ModeSwitchIsland
      name={labels.colourScheme}
      labels={{ system: labels.modeSystem, light: labels.modeLight, dark: labels.modeDark }}
    />
  );
}
