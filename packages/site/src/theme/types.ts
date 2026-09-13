import type { ComponentType } from "preact";

import type { IslandEntry } from "../islands/bundle.js";
import type { SlotName, SlotProps } from "../slots.js";
import type { ResolvedThemeConfig } from "./load.js";

export type SlotComponents = { [S in SlotName]: ComponentType<SlotProps[S]> };

/** A slot rendered by a plugin's theme instead of the default component. */
export interface ThemeOverride {
  slot: SlotName;
  plugin: string;
  theme: string;
}

export interface ResolvedTheme {
  components: SlotComponents;
  /** Sorted by slot; listed in the build summary. */
  overrides: ThemeOverride[];
  /** The `theme.yaml` of the last theme contribution, when the loader could locate its package. */
  config?: ResolvedThemeConfig;
  /** The UI components of the registry as islands, in registration order; the site bundles them next to its own. */
  islands?: IslandEntry[];
}
