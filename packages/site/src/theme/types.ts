import type { ComponentType } from "preact";

import type { IslandEntry } from "../islands/bundle.js";
import type {
  AttributeProps,
  EntityPageProps,
  SectionProps,
  SlotName,
  SlotProps,
} from "../slots.js";
import type { ResolvedThemeConfig } from "./load.js";

export type SlotComponents = { [S in SlotName]: ComponentType<SlotProps[S]> };

/** The components of the parts of an entity page, by attribute name and by section key. */
export interface PartComponents {
  attributes: Record<string, ComponentType<AttributeProps>>;
  sections: Record<string, ComponentType<SectionProps>>;
}

/**
 * The components resolved for one type, one attribute or one section, on top of the slots:
 * `EntityPage@<type>` by type slug, from a theme or from the module of the type, the theme
 * winning; `Attribute@<name>` and `Section@<key>` of the themes, which apply to every type; the
 * same parts of every type module, which apply to that type when no theme provides them.
 */
export interface TypedComponents {
  pages: Record<string, ComponentType<EntityPageProps>>;
  parts: PartComponents;
  typeParts: Record<string, PartComponents>;
}

/** A slot, a typed page or a part rendered by a plugin's theme or a type module instead of the default component. */
export interface ThemeOverride {
  /** `Footer`, `EntityPage@runbook`, `Attribute@steps`... */
  slot: string;
  /** The plugin of the theme, or the plugin of the type module (`types_dir` for a module of the project). */
  plugin: string;
  /** The name of the theme, or `type module` for a component a module ships. */
  theme: string;
}

export interface ResolvedTheme {
  components: SlotComponents;
  /** The components resolved per type, attribute and section; none when nothing typed was provided. */
  typed?: TypedComponents;
  /** Sorted by slot; listed in the build summary. */
  overrides: ThemeOverride[];
  /** The `theme.yaml` of the last theme contribution, when the loader could locate its package. */
  config?: ResolvedThemeConfig;
  /** The UI components of the registry as islands, in registration order; the site bundles them next to its own. */
  islands?: IslandEntry[];
}
