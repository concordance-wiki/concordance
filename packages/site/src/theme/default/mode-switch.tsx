import type { JSX } from "preact";

import { island } from "../../islands/island.js";
import type { ModeChoice } from "../../mode.js";
import { labels } from "./labels.js";

export const MODE_SWITCH_ISLAND = "mode-switch";

/** What the client entry needs: the label of each choice, so that no visible string lives in the bundle. */
export interface ModeSwitchProps {
  labels: Record<ModeChoice, string>;
}

/**
 * The button cycling through automatic, light and dark. It is served hidden and does nothing
 * until its script wires it: without JavaScript the theme's default and the system preference
 * apply, and no dead control is shown.
 */
function ModeSwitchButton({ labels: choices }: ModeSwitchProps): JSX.Element {
  return (
    <button type="button" class="mode-switch" aria-pressed="false" hidden>
      <span class="mode-switch-label">{labels.colourScheme}</span>{" "}
      <span class="mode-switch-value">{choices.system}</span>
    </button>
  );
}

const ModeSwitchIsland = island(MODE_SWITCH_ISLAND, ModeSwitchButton);

export function ModeSwitch(): JSX.Element {
  return (
    <ModeSwitchIsland
      labels={{ system: labels.modeSystem, light: labels.modeLight, dark: labels.modeDark }}
    />
  );
}
