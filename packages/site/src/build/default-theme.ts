import type { ThemeConfig } from "../css/theme-config.js";

/**
 * The palettes of the default theme, for a project without `theme.yaml` and for the gallery: a
 * warm light one, and a dark one measured on its own rather than inverted from the first. The
 * accent marks links and the current position only.
 */
export function defaultThemeConfig(name: string): ThemeConfig {
  return {
    name,
    radius: 8,
    light: {
      bg: "#EFEDE9",
      surface: "#FFFFFF",
      border: "#E3E0DA",
      ink: "#1F2124",
      muted: "#3A3E44",
      accent: "#A8431C",
      label: "#676C74",
      soft: "#F7F6F3",
      highlight: "#FBE3D4",
    },
    dark: {
      bg: "#151618",
      surface: "#1C1E21",
      border: "#2E3136",
      ink: "#ECEAE5",
      muted: "#C5C3BD",
      accent: "#EE8B5C",
      label: "#9C9FA4",
      soft: "#232528",
      highlight: "#4A2A1B",
    },
  };
}
