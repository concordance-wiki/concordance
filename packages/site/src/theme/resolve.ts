import { resolve } from "node:path";

import {
  formatIssue,
  nodeFileSystem,
  type FileSystem,
  type PluginRegistry,
  type ThemeContribution,
} from "@concordance-wiki/core";

import { byCodeUnit } from "../order.js";
import { isSlotName, SLOT_NAMES, type SlotName } from "../slots.js";
import { defaultComponents } from "./default/index.js";
import { loadTheme, type ResolvedThemeConfig } from "./load.js";
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
  /** Absolute folder of a plugin package; without it the `tokens`, stylesheet and assets of the themes are left aside. */
  rootOf?: (plugin: string) => string;
  /** Reads the theme files; the real file system by default. */
  fileSystem?: FileSystem;
}

export const defaultTheme: ResolvedTheme = { components: defaultComponents, overrides: [] };

function compareOverrides(a: ThemeOverride, b: ThemeOverride): number {
  return byCodeUnit(a.slot, b.slot);
}

/** The `tokens` file of a contribution with its stylesheet and assets, or the reason it cannot be used. */
function configOf(
  root: string,
  theme: ThemeContribution,
  label: string,
  fileSystem: FileSystem,
): ResolvedThemeConfig {
  const file = resolve(root, theme.tokens);
  const loaded = loadTheme(fileSystem, file, {
    ...(theme.stylesheet === undefined ? {} : { stylesheet: resolve(root, theme.stylesheet) }),
    ...(theme.assets === undefined ? {} : { assets: resolve(root, theme.assets) }),
  });
  if (!loaded.ok) {
    throw new ThemeResolutionError(
      `${label}: ${loaded.issues.map((issue) => formatIssue(issue, theme.tokens)).join("; ")}`,
    );
  }
  return loaded.theme;
}

/**
 * The default components, each replaced by the last theme of the registry that provides it,
 * and the `tokens` of the last theme when the loader can locate the plugin packages.
 */
export async function resolveTheme(
  registry: PluginRegistry,
  loader: ThemeLoader,
): Promise<ResolvedTheme> {
  const loaded: Partial<Record<SlotName, unknown>> = {};
  const overrides = new Map<SlotName, ThemeOverride>();
  let config: ResolvedThemeConfig | undefined;
  for (const registration of registry.registrations()) {
    for (const theme of registration.manifest.contributes.themes ?? []) {
      const label = `plugin ${registration.name}, theme ${theme.name}`;
      if (loader.rootOf !== undefined) {
        const root = loader.rootOf(registration.name);
        config = configOf(root, theme, label, loader.fileSystem ?? nodeFileSystem);
      }
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
  return {
    components,
    overrides: [...overrides.values()].sort(compareOverrides),
    ...(config === undefined ? {} : { config }),
  };
}
