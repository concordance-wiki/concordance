import { fileURLToPath } from "node:url";

import { PLUGIN_API_VERSION, type PluginManifest, type UiComponent } from "@concordance-wiki/core";

import { CONTRACT_VIEWER_ISLAND } from "./contract-viewer.js";

/** The name the default theme registers under; a configuration never declares it. */
export const DEFAULT_THEME_PLUGIN = "@concordance-wiki/site";

/** The UI components the default theme ships: the contract viewer, whose bundle is its hydration entry. */
export function defaultUiComponents(): UiComponent[] {
  // No extension: the bundler picks the compiled module in a build and the source under test.
  return [
    {
      slot: CONTRACT_VIEWER_ISLAND,
      bundle: fileURLToPath(new URL("../../islands/contract-viewer.client", import.meta.url)),
    },
  ];
}

/**
 * The manifest of the default theme, registered as a built-in before the declared plugins so that
 * the registry lists its UI components and no plugin claims their slots.
 */
export function defaultThemeManifest(): PluginManifest {
  return {
    name: DEFAULT_THEME_PLUGIN,
    version: "0.0.0",
    apiVersion: PLUGIN_API_VERSION,
    contributes: { uiComponents: defaultUiComponents() },
  };
}
