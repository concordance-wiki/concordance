import type { PluginRegistry } from "@concordance-wiki/core";

import { byCodeUnit } from "../order.js";
import { isSlotName, SLOT_NAMES, type SlotName } from "../slots.js";
import { defaultComponents } from "./default/index.js";
import type { ResolvedTheme, SlotComponents, ThemeOverride } from "./types.js";

export class ThemeResolutionError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ThemeResolutionError";
  }
}

export interface ThemeLoader {
  /** Default export of a module of a plugin package, `path` being relative to the package. */
  load: (plugin: string, path: string) => Promise<unknown>;
}

export const defaultTheme: ResolvedTheme = { components: defaultComponents, overrides: [] };

function compareOverrides(a: ThemeOverride, b: ThemeOverride): number {
  return byCodeUnit(a.slot, b.slot);
}

/** The default components, each replaced by the last theme of the registry that provides it. */
export async function resolveTheme(
  registry: PluginRegistry,
  loader: ThemeLoader,
): Promise<ResolvedTheme> {
  const loaded: Partial<Record<SlotName, unknown>> = {};
  const overrides = new Map<SlotName, ThemeOverride>();
  for (const registration of registry.registrations()) {
    for (const theme of registration.manifest.contributes.themes ?? []) {
      const label = `plugin ${registration.name}, theme ${theme.name}`;
      for (const [slot, path] of Object.entries(theme.components ?? {}).sort()) {
        if (!isSlotName(slot)) {
          throw new ThemeResolutionError(
            `${label}: ${slot} is not a slot; slots are ${SLOT_NAMES.join(", ")}`,
          );
        }
        const component = await loader.load(registration.name, path);
        if (typeof component !== "function") {
          throw new ThemeResolutionError(
            `${label}: the default export of ${path} is not a component`,
          );
        }
        loaded[slot] = component;
        overrides.set(slot, { slot, plugin: registration.name, theme: theme.name });
      }
    }
  }
  // A loaded component is a function; the contract of its slot says which props it receives.
  const components: SlotComponents = {
    ...defaultComponents,
    ...(loaded as Partial<SlotComponents>),
  };
  return { components, overrides: [...overrides.values()].sort(compareOverrides) };
}
