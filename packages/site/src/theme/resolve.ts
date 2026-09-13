import { isAbsolute, resolve } from "node:path";

import {
  formatIssue,
  nodeFileSystem,
  type FileSystem,
  type PluginRegistry,
  type ThemeContribution,
  type UiComponent,
} from "@concordance-wiki/core";

import type { TypeModule } from "@concordance-wiki/profile";
import type { ComponentType } from "preact";

import type { IslandEntry } from "../islands/bundle.js";
import { byCodeUnit } from "../order.js";
import {
  parseComponentName,
  SLOT_NAMES,
  type AttributeProps,
  type ComponentName,
  type EntityPageProps,
  type SectionProps,
  type SlotName,
} from "../slots.js";
import { defaultComponents } from "./default/index.js";
import { loadTheme, type ResolvedThemeConfig } from "./load.js";
import type {
  PartComponents,
  ResolvedTheme,
  SlotComponents,
  ThemeOverride,
  TypedComponents,
} from "./types.js";

export class ThemeResolutionError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ThemeResolutionError";
  }
}

export interface ThemeLoader {
  /** Default export of a module of a plugin package, `path` being relative to the package. */
  load: (plugin: string, path: string) => Promise<unknown>;
  /** Default export of a module file given by its absolute path, for the components of the type modules; absent, they are left aside. */
  loadFile?: (path: string) => Promise<unknown>;
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
 * The UI components of a registration as islands: a bundle written as an absolute path is taken
 * as is (the built-in components); a relative one resolves against the plugin package, and is
 * left aside when the loader cannot locate packages.
 */
function islandsOf(
  registration: { name: string; manifest: { contributes: { uiComponents?: UiComponent[] } } },
  loader: ThemeLoader,
): IslandEntry[] {
  const islands: IslandEntry[] = [];
  for (const component of registration.manifest.contributes.uiComponents ?? []) {
    if (isAbsolute(component.bundle)) {
      islands.push({ name: component.slot, entry: component.bundle });
    } else if (loader.rootOf !== undefined) {
      islands.push({
        name: component.slot,
        entry: resolve(loader.rootOf(registration.name), component.bundle),
      });
    }
  }
  return islands;
}

/** Where a loaded component is filed, and how the overrides list names it. */
interface Placement {
  slots: Partial<Record<SlotName, unknown>>;
  typed: TypedComponents;
  overrides: Map<string, ThemeOverride>;
}

function partsOf(typed: TypedComponents, type: string): PartComponents {
  let parts = typed.typeParts[type];
  if (parts === undefined) {
    parts = { attributes: {}, sections: {} };
    typed.typeParts[type] = parts;
  }
  return parts;
}

/** What a component file of a module stands for: `EntityPage` is the page of the module's own type. */
function moduleComponentName(name: string, type: string): ComponentName {
  const at = name.indexOf("@");
  if (at < 0) {
    return { kind: "page", type };
  }
  const key = name.slice(at + 1);
  return name.startsWith("Attribute") ? { kind: "attribute", name: key } : { kind: "section", key };
}

function labelOf(parsed: ComponentName): string {
  switch (parsed.kind) {
    case "slot":
      return parsed.slot;
    case "page":
      return `EntityPage@${parsed.type}`;
    case "attribute":
      return `Attribute@${parsed.name}`;
    case "section":
      return `Section@${parsed.key}`;
  }
}

/**
 * Files a component under its parsed name, for every type when it comes from a theme, for one
 * type when it comes from that type's module. A loaded component is a function; the contract of
 * its name says which props it receives, so each store takes it as the component of that contract.
 */
function place(
  placement: Placement,
  parsed: ComponentName,
  component: ComponentType<never>,
  origin: { plugin: string; theme: string },
  moduleType?: string,
): void {
  const { typed } = placement;
  const parts = moduleType === undefined ? typed.parts : partsOf(typed, moduleType);
  switch (parsed.kind) {
    case "slot":
      placement.slots[parsed.slot] = component;
      break;
    case "page":
      typed.pages[parsed.type] = component as ComponentType<EntityPageProps>;
      break;
    case "attribute":
      parts.attributes[parsed.name] = component as ComponentType<AttributeProps>;
      break;
    case "section":
      parts.sections[parsed.key] = component as ComponentType<SectionProps>;
      break;
  }
  const slot = labelOf(parsed);
  placement.overrides.set(slot, { slot, ...origin });
}

async function componentOf(
  load: () => Promise<unknown>,
  label: string,
  path: string,
): Promise<ComponentType<never>> {
  const component = await load();
  if (typeof component !== "function") {
    throw new ThemeResolutionError(`${label}: the default export of ${path} is not a component`);
  }
  // A function loaded from a module is taken as a component; its name says which props it takes.
  return component as ComponentType<never>;
}

/** What the resolution accumulates over the modules and the themes. */
interface Resolution {
  placement: Placement;
  islands: IslandEntry[];
  config?: ResolvedThemeConfig;
  /** Whether any component was placed per type, which is when the typed components are returned. */
  anyTyped: boolean;
}

/** The components of the type modules, for their own type, when the loader can import a file. */
async function placeModules(
  resolution: Resolution,
  modules: readonly TypeModule[],
  loadFile: (path: string) => Promise<unknown>,
): Promise<void> {
  for (const module of modules) {
    const origin = { plugin: module.origin ?? "types_dir", theme: "type module" };
    const entries = Object.entries(module.components).sort(([a], [b]) => byCodeUnit(a, b));
    for (const [name, path] of entries) {
      const label = `type module ${module.slug}`;
      const component = await componentOf(() => loadFile(path), label, path);
      const parsed = moduleComponentName(name, module.slug);
      place(resolution.placement, parsed, component, origin, module.slug);
      resolution.anyTyped = true;
    }
  }
}

/** The components of one theme of a plugin, which win over the modules. */
async function placeTheme(
  resolution: Resolution,
  plugin: string,
  theme: ThemeContribution,
  loader: ThemeLoader,
): Promise<void> {
  const label = `plugin ${plugin}, theme ${theme.name}`;
  if (loader.rootOf !== undefined) {
    const root = loader.rootOf(plugin);
    resolution.config = configOf(root, theme, label, loader.fileSystem ?? nodeFileSystem);
  }
  const origin = { plugin, theme: theme.name };
  const entries = Object.entries(theme.components ?? {}).sort(([a], [b]) => byCodeUnit(a, b));
  for (const [name, path] of entries) {
    const parsed = parseComponentName(name);
    if (parsed === undefined) {
      throw new ThemeResolutionError(
        `${label}: ${name} is not a slot; slots are ${SLOT_NAMES.join(", ")}, EntityPage@<type>, Attribute@<attribute> or Section@<section>`,
      );
    }
    const component = await componentOf(() => loader.load(plugin, path), label, path);
    place(resolution.placement, parsed, component, origin);
    resolution.anyTyped = resolution.anyTyped || parsed.kind !== "slot";
  }
}

/**
 * The default components, each replaced by the last theme of the registry that provides it,
 * the `tokens` of the last theme when the loader can locate the plugin packages, the UI
 * components of every registration as islands to bundle, and the components resolved per type:
 * those of the type modules first (`EntityPage`, `Attribute@<name>`, `Section@<key>` of each
 * module, for its own type, when the loader can import a file), then those of the themes
 * (`EntityPage@<type>`, `Attribute@<name>`, `Section@<key>`), which win over the modules.
 */
export async function resolveTheme(
  registry: PluginRegistry,
  loader: ThemeLoader,
  modules: readonly TypeModule[] = [],
): Promise<ResolvedTheme> {
  const resolution: Resolution = {
    placement: {
      slots: {},
      typed: { pages: {}, parts: { attributes: {}, sections: {} }, typeParts: {} },
      overrides: new Map(),
    },
    islands: [],
    anyTyped: false,
  };
  if (loader.loadFile !== undefined) await placeModules(resolution, modules, loader.loadFile);
  for (const registration of registry.registrations()) {
    resolution.islands.push(...islandsOf(registration, loader));
    for (const theme of registration.manifest.contributes.themes ?? []) {
      await placeTheme(resolution, registration.name, theme, loader);
    }
  }
  const { placement, islands, config, anyTyped } = resolution;
  // A loaded component is a function; the contract of its slot says which props it receives.
  const components: SlotComponents = {
    ...defaultComponents,
    ...(placement.slots as Partial<SlotComponents>),
  };
  return {
    components,
    ...(anyTyped ? { typed: placement.typed } : {}),
    overrides: [...placement.overrides.values()].sort(compareOverrides),
    ...(config === undefined ? {} : { config }),
    islands,
  };
}
